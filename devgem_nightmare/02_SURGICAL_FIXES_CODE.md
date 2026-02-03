# DevGem: Surgical Fixes Implementation Guide
## Ready-to-Apply Code Changes

> This document provides **copy-paste ready** code fixes for the most critical blockers.

---

## Fix 1: Dynamic Port Configuration

### Problem
Port 8080 is hardcoded everywhere, but apps use different ports.

### File: `backend/services/gcloud_service.py`

**Find line 847:**
```python
container.ports = [run_v2.ContainerPort(container_port=8080)]
```

**Replace with:**
```python
# Use PORT from analysis or default to 8080
detected_port = int(env_vars.get('PORT', 8080)) if env_vars else 8080
container.ports = [run_v2.ContainerPort(container_port=detected_port, name='http1')]
```

**Also update probes (lines 862-877):**
```python
# Startup probe - use detected port
container.startup_probe = run_v2.Probe(
    tcp_socket=run_v2.TCPSocketAction(port=detected_port),
    initial_delay_seconds=0,
    timeout_seconds=10,
    period_seconds=5,
    failure_threshold=36  # 180s max startup
)

# Liveness probe - TCP only (no /health assumption)
container.liveness_probe = run_v2.Probe(
    tcp_socket=run_v2.TCPSocketAction(port=detected_port),
    initial_delay_seconds=30,
    period_seconds=30,
    timeout_seconds=10,
    failure_threshold=3
)
```

---

## Fix 2: Debian-Slim Base Images

### Problem
Alpine uses musl libc, breaking many npm/pip packages.

### File: `backend/agents/docker_expert.py`

**Find and replace all occurrences:**

| Find | Replace |
|------|---------|
| `FROM node:20-alpine` | `FROM node:20-slim` |
| `FROM node:18-alpine` | `FROM node:18-slim` |
| `FROM python:3.11-alpine` | `FROM python:3.11-slim` |
| `FROM python:3.12-alpine` | `FROM python:3.12-slim` |

**Example in Next.js template (around line 30):**
```python
'nextjs': '''
# Stage 1: Dependencies
FROM node:20-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Build
FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 3: Production
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
''',
```

---

## Fix 3: Enhanced Error Handling in Deployment

### Problem
Errors are cryptic and don't help users fix issues.

### File: `backend/services/gcloud_service.py`

**Add after line 1111 (in the exception handler):**

```python
except Exception as e:
    error_msg = str(e)
    self.logger.error(f"Deployment failed: {error_msg}")
    
    # Humanize common errors
    humanized_error = self._humanize_deployment_error(error_msg)
    
    return {
        'success': False,
        'service_name': unique_service_name,
        'latest_revision': latest_rev,
        'error': humanized_error['message'],
        'remediation': humanized_error['remediation']
    }
```

**Add new method after line 1207:**

```python
def _humanize_deployment_error(self, error: str) -> Dict:
    """Convert technical errors to user-friendly messages with remediation."""
    
    error_lower = error.lower()
    
    if 'container failed to start' in error_lower or 'port' in error_lower:
        return {
            'message': 'Your container failed to start. This usually means the app crashed during startup.',
            'remediation': [
                'Check that your app binds to $PORT (Cloud Run injects this)',
                'Verify your start command is correct in package.json or Dockerfile',
                'Add console.log() statements to debug startup issues',
                'Check for missing environment variables'
            ]
        }
    
    if 'permission denied' in error_lower or '403' in error_lower:
        return {
            'message': 'Permission denied accessing Google Cloud resources.',
            'remediation': [
                'Ensure Cloud Run API is enabled',
                'Verify service account has required roles',
                'Check if billing is enabled on the project'
            ]
        }
    
    if 'image not found' in error_lower or 'manifest unknown' in error_lower:
        return {
            'message': 'The container image could not be found. Build may have failed.',
            'remediation': [
                'Check Cloud Build logs for errors',
                'Verify Artifact Registry repository exists',
                'Try re-deploying to trigger a fresh build'
            ]
        }
    
    if 'timeout' in error_lower:
        return {
            'message': 'The operation timed out. This can happen with large apps.',
            'remediation': [
                'Try deploying again - GCP may have been under load',
                'Check if your Dockerfile has efficient caching',
                'Reduce image size by removing unnecessary files'
            ]
        }
    
    if 'quota' in error_lower or 'resource exhausted' in error_lower:
        return {
            'message': 'Google Cloud quota limit reached.',
            'remediation': [
                'Wait a few minutes and try again',
                'Check your GCP quotas in the console',
                'Contact support if limits need to be increased'
            ]
        }
    
    # Default
    return {
        'message': f'Deployment failed: {error}',
        'remediation': [
            'Check the error details above',
            'Try deploying again',
            'Contact support if the issue persists'
        ]
    }
```

---

## Fix 4: IAM Propagation Wait

### Problem
IAM policy changes take time to propagate, causing 403 errors.

### File: `backend/services/gcloud_service.py`

**After the IAM policy set (around line 1051), add:**

```python
# Wait for IAM propagation
self.logger.info("Waiting for IAM propagation...")
import requests

iam_ready = False
for attempt in range(12):  # Try for 60 seconds
    try:
        response = await asyncio.to_thread(
            requests.get,
            service_url,
            timeout=5,
            allow_redirects=True
        )
        if response.status_code != 403:
            iam_ready = True
            self.logger.info(f"IAM propagation complete (attempt {attempt + 1})")
            break
    except Exception as e:
        self.logger.debug(f"IAM check failed: {e}")
    
    if progress_callback:
        await progress_callback({
            'stage': 'deploy',
            'progress': 96 + (attempt * 0.3),
            'message': f'Waiting for public access... ({attempt * 5}s)'
        })
    
    await asyncio.sleep(5)

if not iam_ready:
    self.logger.warning("IAM propagation may be slow. URL should work shortly.")
```

---

## Fix 5: Consistent Progress Flushing

### Problem
Progress messages don't appear in real-time.

### Create utility function in `backend/utils/progress_helpers.py`:

```python
"""
Progress Helpers - Ensure consistent message delivery
"""
import asyncio

async def send_and_flush(callback, message: str, notifier=None, stage=None):
    """Send a progress message and force event loop flush."""
    if callback:
        try:
            await callback(message)
        except Exception as e:
            print(f"[Progress] Callback error: {e}")
    
    if notifier and stage:
        try:
            await notifier.send_update(stage, "in-progress", message)
        except Exception as e:
            print(f"[Progress] Notifier error: {e}")
    
    # CRITICAL: Force event loop to flush the message immediately
    await asyncio.sleep(0)
```

### Use everywhere by importing:
```python
from utils.progress_helpers import send_and_flush

# Instead of:
await progress_callback("Building...")

# Use:
await send_and_flush(progress_callback, "Building...")
```

---

## Fix 6: Environment Variable Injection

### Problem
Detected port from analysis isn't being injected.

### File: `backend/agents/orchestrator.py`

**In `_handle_deploy_to_cloudrun` (around line 1150):**

```python
# Get analysis results for port detection
analysis_results = self.project_context.get('analysis_results', {})
detected_port = analysis_results.get('port', 8080)

# Ensure PORT is always in env_vars
if not env_vars:
    env_vars = {}

if 'PORT' not in env_vars:
    env_vars['PORT'] = str(detected_port)
    print(f"[Orchestrator] Auto-injected PORT={detected_port} from analysis")
```

---

## Fix 7: Cloud Run Service Annotations

### Problem
Some framework-specific settings aren't configured.

### File: `backend/services/gcloud_service.py`

**After line 879 (after setting containers):**

```python
# Service-level annotations for reliability
service.annotations = {
    'run.googleapis.com/ingress': 'all',  # Allow public access
    'run.googleapis.com/execution-environment': 'gen2',  # Use 2nd gen
}

# Revision-level labels for tracking
service.template.labels = {
    'managed-by': 'devgem',
    'deployed-at': datetime.now().strftime('%Y%m%d-%H%M%S'),
}
```

---

## Fix 8: Frontend Error Display Enhancement

### File: `src/components/ChatMessage.tsx`

**Add error remediation display:**

```typescript
// If message contains remediation steps, render them nicely
const renderRemediation = (content: string) => {
  const remediationMatch = content.match(/remediation.*?:(.*?)(?=\n\n|$)/is);
  if (!remediationMatch) return null;
  
  const steps = remediationMatch[1].split('\n')
    .filter(s => s.trim())
    .map(s => s.replace(/^[-•*]\s*/, '').trim());
  
  return (
    <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
      <h4 className="text-sm font-semibold text-yellow-300 mb-2">
        💡 How to fix this:
      </h4>
      <ul className="space-y-1">
        {steps.map((step, i) => (
          <li key={i} className="text-sm text-yellow-200/80 flex gap-2">
            <span className="text-yellow-400">{i + 1}.</span>
            {step}
          </li>
        ))}
      </ul>
    </div>
  );
};
```

---

## Fix 9: Session Recovery on Reconnect

### File: `src/hooks/useChat.ts`

**Enhance reconnection logic:**

```typescript
// On reconnect, request state restoration
socket.on('connected', (data) => {
  // If we had messages before, we're reconnecting
  if (messages.length > 0) {
    socket.emit('restore_session', {
      session_id: sessionId,
      last_message_id: messages[messages.length - 1].id
    });
  }
});
```

### File: `backend/app.py`

**Add restore handler:**

```python
if msg_type == 'restore_session':
    last_msg_id = data.get('last_message_id')
    
    # Send current context summary
    context = user_orchestrator.project_context
    summary = []
    
    if context.get('repo_url'):
        summary.append(f"Repository: {context['repo_url']}")
    if context.get('framework'):
        summary.append(f"Framework: {context['framework']}")
    if context.get('project_path'):
        summary.append(f"Status: Ready to deploy")
    
    if summary:
        await safe_send_json(session_id, {
            'type': 'session_restored',
            'data': {
                'content': f"🔄 Session restored!\n\n{chr(10).join(summary)}",
                'context': context
            },
            'timestamp': datetime.now().isoformat()
        })
```

---

## Verification Checklist

After applying fixes:

- [ ] Deploy a Next.js app → Should use port 3000
- [ ] Deploy a Python FastAPI app → Should use port 8080
- [ ] Deploy a private repo → Should clone successfully
- [ ] Reconnect during build → Should see current progress
- [ ] Deployment failure → Should see human-readable error + remediation

---

## Testing Commands

```bash
# Test backend
cd backend
python -m pytest tests/ -v

# Test frontend build
npm run build

# Manual end-to-end test
# 1. Start backend: python app.py
# 2. Start frontend: npm run dev
# 3. Connect GitHub
# 4. Deploy any repo
# 5. Verify confetti appears with working URL
```

---

*These surgical fixes address the core blockers. Apply them systematically and test after each change.*
