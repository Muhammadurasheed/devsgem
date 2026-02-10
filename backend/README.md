# DevGem Backend

**AI-Powered Deployment Engine — Built with Gemini 3**

FastAPI · Python 3.11 · Vertex AI · 7 Agents · 24 Services

---

## Overview

The DevGem backend is a FastAPI-based agentic deployment engine that orchestrates 7 specialized AI agents and 24 cloud services to deploy any GitHub repository to Google Cloud Run through natural language.

**No gcloud CLI.** Everything is done via Google Cloud Python client libraries.

---

## AI Agents

| Agent | Model | Role |
|:------|:------|:-----|
| **OrchestratorAgent** | `gemini-3-pro-preview` | Central coordinator. Gemini function calling routes user requests, manages context, and orchestrates the full deployment pipeline. 4,765 lines |
| **CodeAnalyzerAgent** | `gemini-3-flash-preview` | Dual-phase analysis: rule-based heuristic scoring (25+ framework signatures) validated by Gemini. Detects language, framework, ports, entry points, dependencies. 841 lines |
| **DockerExpertAgent** | `gemini-3-flash-preview` | Generates production Dockerfiles from 15+ templates. Uses Gemini to resolve native system dependencies (e.g. `opencv` → `libgl1`). 736 lines |
| **GeminiBrainAgent** | `gemini-3-pro-preview` | Autonomous error diagnosis with three-tier fallback: Vertex Pro → Vertex Flash → Gemini API. 870 lines |
| **MonitoringAgent** | `gemini-3-flash-preview` | Runtime health analysis and deployment monitoring |
| **GeminiFixHandler** | `gemini-3-flash-preview` | Applies AI-generated code fixes to source files |
| **GeminiTools** | — | Function declarations for Gemini function calling |

---

## Services

24 service modules power the platform:

**Core Deployment**
- `gcloud_service.py` — Cloud Build, Cloud Run v2, Artifact Registry, IAM, Secret Manager (2,541 lines)
- `deployment_service.py` — Deployment lifecycle, state persistence, status tracking
- `deployment_progress.py` — Real-time progress engine with monotonic boosting
- `secret_sync_service.py` — Two-way sync: Dashboard ↔ Secret Manager ↔ Cloud Run

**GitHub & Auth**
- `github_service.py` — Repository management, OAuth token handling
- `github_auth.py` — GitHub OAuth flow
- `google_auth.py` — Google OAuth integration
- `user_service.py` — User profile management

**Analysis & Intelligence**
- `analysis_service.py` — Code analysis coordination and caching
- `branding_service.py` — Framework logo detection
- `security.py` — Dockerfile validation, env var sanitization
- `optimization.py` — Container optimization recommendations
- `health_check.py` — Post-deployment TCP health verification

**Infrastructure**
- `cloud_storage_service.py` — GCS operations for source uploads and log retrieval
- `monitoring.py` — Cloud Logging integration for runtime logs
- `preview_service.py` — Deployment screenshot generation via Playwright
- `docker_service.py` — Local Docker operations
- `source_control_service.py` — Git operations, repo cloning
- `domain_service.py` — Custom domain mapping

**State & Preferences**
- `session_store.py` — In-memory session management
- `sqlite_session_store.py` — Persistent SQLite session storage
- `usage_service.py` — API usage tracking and rate limiting
- `preferences_service.py` — User preference storage

---

## Quick Start

**1. Install**

```bash
cd backend
pip install -r requirements.txt
```

**2. Configure**

Create `.env` in the `backend/` directory:

```env
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_REGION=us-central1
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
GEMINI_API_KEY=your-gemini-api-key
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_TOKEN=your-github-pat
```

**3. Enable GCP APIs**

```bash
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudresourcemanager.googleapis.com \
  logging.googleapis.com
```

**4. Run**

```bash
python app.py
```

Server starts at `http://localhost:8000`

---

## API Reference

**REST Endpoints**

| Method | Path | Description |
|:-------|:-----|:------------|
| `GET` | `/health` | Health check |
| `POST` | `/chat` | Send message to AI |
| `GET` | `/api/deployments` | List deployments |
| `GET` | `/api/deployments/{id}` | Deployment details |
| `GET` | `/api/deployments/{id}/logs` | Build & runtime logs |
| `POST` | `/api/deployments/{id}/env` | Update environment variables |
| `POST` | `/api/deployments/{id}/abort` | Abort active deployment |

**WebSocket**

| Path | Description |
|:-----|:------------|
| `WS /ws/chat` | Real-time bidirectional communication |

Message types: `message` · `analysis` · `deployment_started` · `deployment_progress` · `deployment_update` · `deployment_complete` · `ai_thought` · `monitoring_alert` · `ping/pong`

---

## Deployment Pipeline

```
1. Repository Access     git clone --depth 1 (authenticated)
2. Code Analysis         Heuristic engine + Gemini validation
3. Dockerfile Generation Template matching + native lib resolution
4. Environment Config    .env parsing + Secret Manager sync
5. Security Scan         Dockerfile + env var validation
6. Container Build       Cloud Build + Kaniko (no Docker daemon)
7. Cloud Run Deploy      Cloud Run v2 API + IAM automation
```

---

## Key Design Decisions

| Decision | Rationale |
|:---------|:----------|
| `node:20-slim` over Alpine | Alpine uses `musl` not `glibc` — causes silent failures with native modules |
| Kaniko over Docker-in-Docker | No privileged container access. Secure, daemon-less image construction |
| True Remote Build | Cloud Build clones from GitHub. Language-aware healing files injected via base64 |
| TCP startup probes | Can't assume the app serves `/`. TCP verifies the port is listening |
| Dual-port sensing | `dev_port` for local, `deploy_port` (8080) for Cloud Run |
| Monotonic progress | Progress bar never goes backward. Time-based virtual increments |

---

## Resilience

- Multi-region Gemini failover across 4 Vertex AI regions + direct API
- Exponential backoff with jitter on all API calls
- `asyncio.Event`-based abort propagation — cancellation reaches all agents instantly
- Session rehydration via SQLite across page refreshes
- IAM propagation polling — verifies URL is publicly accessible before returning

---

*Built with Gemini 3 for the Gemini 3 Global Hackathon*
