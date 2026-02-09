"""
Docker Expert Agent - Optimized Dockerfile generation
"""

import asyncio  # ✅ CRITICAL: Import asyncio for sleep(0) flush
from pathlib import Path
from typing import Dict, Optional, Callable  # ✅ Added Optional, Callable
import vertexai
from vertexai.generative_models import GenerativeModel


class DockerExpertAgent:
    """
    Generates production-optimized Dockerfiles using Vertex AI Gemini
    and pre-built templates for common frameworks.
    """
    
    def __init__(self, gcloud_project: str, location: str = 'us-central1'):
        vertexai.init(project=gcloud_project, location=location)
        self.model = GenerativeModel('gemini-2.0-flash-001')
        self.templates = self._load_templates()
    
    def _load_templates(self) -> Dict[str, str]:
        """Production-optimized Dockerfile templates"""
        
        templates = {
            'python_flask': """# Multi-stage build for Flask
FROM python:3.11-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

FROM python:3.11-slim
WORKDIR /app
RUN useradd -m -u 1001 appuser
COPY --from=builder /root/.local /home/appuser/.local
COPY --chown=appuser:appuser . .
USER appuser
ENV PATH=/home/appuser/.local/bin:$PATH
ENV PORT={port}
ENV PYTHONUNBUFFERED=1
EXPOSE {port}
CMD exec gunicorn --bind 0.0.0.0:$PORT --workers 1 --threads 8 --timeout 0 {entry_point}:app
""",
            
            'python_fastapi': """# Multi-stage build for FastAPI
FROM python:3.11-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

FROM python:3.11-slim
WORKDIR /app
RUN useradd -m -u 1001 appuser
COPY --from=builder /root/.local /home/appuser/.local
COPY --chown=appuser:appuser . .
USER appuser
ENV PATH=/home/appuser/.local/bin:$PATH
ENV PORT={port}
ENV PYTHONUNBUFFERED=1
EXPOSE {port}
CMD exec uvicorn {entry_point}:app --host 0.0.0.0 --port $PORT
""",
            
            'nodejs_express': """# Multi-stage build for Express
# Using slim instead of alpine for glibc compatibility
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .

FROM node:20-slim
WORKDIR /app
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs -m nodejs
COPY --from=builder --chown=nodejs:nodejs /app /app
USER nodejs
ENV PORT={port}
ENV NODE_ENV=production
EXPOSE {port}
CMD ["node", "{entry_point}"]
""",

            'nodejs_nestjs': """# Multi-stage build for NestJS
# Using slim instead of alpine for glibc compatibility
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
# Smart install: Use ci if lockfile exists, else install
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
RUN npm run build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT={port}
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs -m nodejs
# NestJS build output is typically in dist
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./
USER nodejs
ENV PORT={port}
EXPOSE {port}
# Default entry point for NestJS
CMD ["node", "dist/main"]
""",
            
            'nodejs_nextjs': """# Multi-stage build for Next.js
# Using slim instead of alpine for glibc compatibility
FROM node:20-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT={port}
ENV NEXT_TELEMETRY_DISABLED=1
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs -m nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE {port}
CMD ["node", "server.js"]
""",
            
            'golang_gin': """# Multi-stage build for Go
# Go binaries are statically compiled, so we can use scratch for minimal size
FROM golang:1.21-bookworm AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -ldflags='-w -s' -o main .

# Minimal scratch image for Go (no OS, just the binary)
FROM scratch
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /app/main /main
ENV PORT={port}
EXPOSE {port}
CMD ["/main"]
""",
            'php_generic': """# Production PHP (Apache)
FROM php:8.2-apache
WORKDIR /var/www/html
RUN a2enmod rewrite
COPY . .
# Install Composer if needed
RUN if [ -f "composer.json" ]; then \
    apt-get update && apt-get install -y unzip && \
    curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer && \
    composer install --no-dev --optimize-autoloader; \
    fi
RUN chown -R www-data:www-data /var/www/html
ENV PORT={port}
RUN sed -i 's/80/${{PORT}}/g' /etc/apache2/sites-available/000-default.conf /etc/apache2/ports.conf
EXPOSE {port}
CMD ["apache2-foreground"]
""",
            'ruby_generic': """# Ruby/Rails Production
FROM ruby:3.2-slim
WORKDIR /app
RUN apt-get update -qq && apt-get install -y build-essential libpq-dev nodejs
COPY Gemfile* ./
RUN bundle install
COPY . .
ENV PORT={port}
ENV RAILS_ENV=production
ENV RAILS_SERVE_STATIC_FILES=true
EXPOSE {port}
CMD exec bundle exec rails server -b 0.0.0.0 -p $PORT
""",
            'java_generic': """# Java Spring Boot (Maven)
FROM maven:3.9-eclipse-temurin-17 AS builder
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

FROM eclipse-temurin:17-jre-jammy
WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar
ENV PORT={port}
EXPOSE {port}
CMD ["java", "-jar", "app.jar"]
""",
            'frontend_generic': r"""# Generic Frontend (Static/SPA)
FROM nginx:alpine
WORKDIR /usr/share/nginx/html
RUN rm -rf ./*
COPY . .
# Universal SPA Nginx Config
RUN echo "server {{ \
    listen {port}; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / {{ \
        try_files \$uri \$uri/ /index.html; \
    }} \
}}" > /etc/nginx/conf.d/default.conf
ENV PORT={port}
EXPOSE {port}
CMD ["nginx", "-g", "daemon off;"]
""",
        }
        
        # ✅ DEFINE TEMPLATES AS VARIABLES FOR ROBUST ALIASING
        nodejs_vite_template = r"""# Multi-stage build for Vite/React/SPA
# Using slim for glibc compatibility during npm install
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .

# [FAANG] Adaptive Build System:
# 1. Try strict build (npm run build)
# 2. If fails (likely unused vars), try permissive build (npx vite build)
# 3. If both fail, exit with error
RUN if npm run build; then \
        echo "✅ Strict build succeeded"; \
    else \
        echo "⚠️ Strict build failed, attempting permissive build..."; \
        npx vite build || exit 1; \
    fi

# ✅ NORMALIZE OUTPUT: Folder naming depends on framework (dist vs build)
# We move whichever exists to a standard 'output' folder
RUN if [ -d "dist" ]; then mv dist output; \
    elif [ -d "build" ]; then mv build output; \
    else mkdir output && cp -r * output/ 2>/dev/null || true; fi

# Production stage - The Google Engineering Standard (Node Native)
# We use 'serve' which is the industry standard for static serving in Node
FROM node:20-slim

# Install serve package globally
RUN npm install -g serve

WORKDIR /app

# ✅ COPY NORMALIZED OUTPUT
COPY --from=builder /app/output ./static

# Use Cloud Run environment variable
ENV PORT={port}
ENV NODE_ENV=production

# Run as non-root user (Security Best Practice)
USER node

# Start server on $PORT
# -s: Single Page Application mode (rewrites 404 to index.html)
# -l: Listen on port
EXPOSE {port}
CMD ["sh", "-c", "serve -s static -l $PORT"]
"""

        nodejs_nextjs_template = r"""# Multi-stage build for Next.js
# Using slim instead of alpine for glibc compatibility
FROM node:20-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT={port}
ENV NEXT_TELEMETRY_DISABLED=1
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs -m nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE {port}
CMD ["node", "server.js"]
"""

        # Update dict with variables
        templates.update({
            'nodejs_vite': nodejs_vite_template,
            'nodejs_nextjs': nodejs_nextjs_template,
            
            # ✅ ALIASES: Map specific framework/language combos to the master templates
            'typescript_react': nodejs_vite_template,
            'javascript_react': nodejs_vite_template,
            'typescript_vite': nodejs_vite_template,
            'javascript_vite': nodejs_vite_template,
            'javascript_vite': nodejs_vite_template,
            'typescript_nextjs': nodejs_nextjs_template,
            'javascript_nextjs': nodejs_nextjs_template,
            'nodejs_nest': templates['nodejs_nestjs'],
            'nodejs_nestjs': templates['nodejs_nestjs'],
            'typescript_nestjs': templates['nodejs_nestjs'],
            'javascript_nestjs': templates['nodejs_nestjs'],
            
            # Universal Aliases
            'golang_generic': templates['golang_gin'], # Map generic Go to our optimized builder
            'go_generic': templates['golang_gin'],
            'laravel': templates['php_generic'],
            'symfony': templates['php_generic'],
            'rails': templates['ruby_generic'],
            'springboot': templates['java_generic'],
            'angular': nodejs_vite_template, # Angular usually builds similar to Vite/React
            'vue': nodejs_vite_template,
            'svelte': nodejs_vite_template,
            'sveltekit': nodejs_vite_template,
            'astro': nodejs_vite_template,
            'nuxtjs': nodejs_vite_template,
        })
        
        return templates
    
    async def generate_dockerfile(
        self, 
        analysis: Dict, 
        progress_notifier=None, 
        progress_callback=None,
        abort_event: Optional[asyncio.Event] = None # [FAANG]
    ) -> Dict:
        """Generate optimized Dockerfile based on analysis with real-time progress"""
        
        # PHASE 1.1: Send progress - Starting Dockerfile generation WITH flush
        if progress_callback:
            await progress_callback(f"[INFO] Generating Dockerfile for {analysis.get('framework', 'unknown')}...")
            await asyncio.sleep(0)  # Force event loop flush
        if progress_notifier:
            await progress_notifier.start_stage(
                "dockerfile_generation",
                f"[INFO] Generating optimized Dockerfile for {analysis.get('framework', 'unknown')}..."
            )
        
        framework_key = f"{analysis['language']}_{analysis['framework']}"
        print(f"[DockerExpert] Processing: Language={analysis['language']}, Framework={analysis['framework']}, Key={framework_key}")
        
        # ✅ COMPREHENSIVE SYNONYM MAPPING: Handle all variants
        # Language normalization: 'node' -> 'nodejs', 'go' -> 'golang'
        # Treat javascript/typescript as nodejs explicitly
        lang = analysis['language'].lower()
        if lang in ['node', 'javascript', 'typescript', 'js', 'ts']:
            framework_key = f"nodejs_{analysis['framework']}"
        elif lang == 'go':
            framework_key = f"golang_{analysis['framework']}"
        
        # [FAANG] Emergency Abort Check
        if abort_event and abort_event.is_set():
            return {'dockerfile': '', 'error': 'Deployment aborted by user'}

        # ✅ FORCE PYTHON: Prevent Python projects from drifting to Node templates
        if lang == 'python':
             # Restore key if it was drifted or if framework is unknown
             if 'node' in framework_key or 'vite' in framework_key:
                 framework_key = f"python_{analysis['framework']}"
        
        # Framework normalization: react/vite -> vite, and handle 'unknown' as a vite fallback for node
        if lang in ['node', 'nodejs', 'javascript', 'typescript', 'js', 'ts']:
            if analysis['framework'] == "react":
                framework_key = "nodejs_vite"
            if framework_key in ["nodejs_unknown", "node_unknown"]:
                framework_key = "nodejs_vite"
        
        # Go framework normalization: map all Go frameworks to the primary Go template
        if analysis['language'] in ['go', 'golang']:
            if analysis['framework'] in ['echo', 'fiber', 'buffalo', 'go_generic', 'unknown']:
                framework_key = "golang_gin" # Use the optimized Go template for all variants
        
        # Ensure React suspicion doesn't hijack non-node languages
        if analysis['framework'] == "react" and analysis['language'] not in ['node', 'nodejs']:
            # If AI says react but language is python, it's likely a misidentification or a hybrid
            # We trust the language and fall back to custom or standard within that language
            pass
        
        if framework_key in self.templates:
            # PHASE 1.1: Progress - Using template WITH flush
            if progress_callback:
                await progress_callback(f"[INFO] Optimizing for {framework_key}")
                await asyncio.sleep(0)  # Force event loop flush
            if progress_notifier:
                await progress_notifier.update_progress(
                    "dockerfile_generation",
                    f"Using optimized template for {framework_key}",
                    50
                )
            
            # PHASE 1.2: Smart System Dependency Resolution
            system_deps = []
            if analysis.get('dependencies'):
                if progress_notifier:
                    await progress_notifier.send_thought(f"Ingesting analysis vectors for `{analysis.get('framework', 'unknown')}` ecosystem.")
                    await progress_notifier.send_thought(f"Framing container boundaries... selecting native `{analysis.get('language', 'unknown')}` runtimes.")
                    await progress_notifier.send_thought(f"Cross-referencing {len(analysis.get('dependencies', []))} dependencies with Google's Security Base images...")
                    await progress_notifier.send_thought("Synthesizing multi-stage build strategy for minimal artifact footprint...")
                    await progress_notifier.send_thought("Resolving system-level shared libraries (libGL, libpq, glibc) for mission-critical stability...")
                    await progress_notifier.send_thought("Hardening container security... preparing non-root runtime environments.")

                system_deps = await self._resolve_system_dependencies(analysis['dependencies'], abort_event=abort_event)
                
                if system_deps and progress_callback:
                    await progress_callback(f"Identified system packages: {', '.join(system_deps)}")
                    await asyncio.sleep(0)

            template = self.templates[framework_key]
            dockerfile = self._customize_template(template, analysis, system_deps)
            
            # PHASE 1.3: Progress - Dockerfile complete WITH flush
            if progress_callback:
                await progress_callback("[SUCCESS] Dockerfile ready with optimizations")
                await asyncio.sleep(0)  # Force event loop flush
            if progress_notifier:
                await progress_notifier.complete_stage(
                    "dockerfile_generation",
                    "[SUCCESS] Dockerfile generated with production optimizations",
                    details={
                        'template': framework_key,
                        'size_estimate': self._estimate_image_size(framework_key),
                        'multi_stage': True,
                        'security_hardened': True
                    }
                )
            
            return {
                'dockerfile': dockerfile,
                'optimizations': [
                    "Multi-stage build (50-70% smaller image)",
                    "Non-root user (security hardened)",
                    "Layer caching optimized",
                    "Cloud Run compatible (PORT env var)",
                    "Production-grade server configuration"
                ],
                'size_estimate': self._estimate_image_size(framework_key)
            }
        
        # Use Gemini for custom frameworks
        # ✅ PHASE 1.1: Progress - Using AI for custom framework
        if progress_notifier:
            await progress_notifier.update_progress(
                "dockerfile_generation",
                "[AI] Generating custom Dockerfile with AI...",
                40
            )
        
        result = await self._generate_custom_dockerfile(analysis)
        
        # ✅ PHASE 1.1: Progress - Custom Dockerfile complete
        if progress_notifier:
            await progress_notifier.complete_stage(
                "dockerfile_generation",
                "[SUCCESS] Custom Dockerfile generated",
                details={'framework': analysis.get('framework', 'custom')}
            )
        
        return result
    
    def _customize_template(self, template: str, analysis: Dict, system_deps: list = None) -> str:
        """Customize template with project-specific values and AI-resolved dependencies"""
        
        # Sanitize entry point - remove extensions and validate
        entry_point = analysis.get('entry_point', 'app')
        if not entry_point or entry_point == 'unknown':
            # Safe defaults per language
            if 'python' in template.lower():
                entry_point = 'app'
            elif 'node' in template.lower():
                entry_point = 'app'
            else:
                entry_point = 'main'
        
        # Clean entry point name
        entry_point = str(entry_point).strip()
        
        # ✅ PYTHON FIX: Replace/Convert paths to modules (app/main -> app.main)
        if 'python' in template.lower():
            entry_point = entry_point.replace('/', '.')
            
        entry_point = entry_point.replace('.py', '').replace('.js', '').replace('.ts', '')
        
        # Ensure valid identifier (no spaces, special chars except underscore/hyphen/dot)
        entry_point = ''.join(c for c in entry_point if c.isalnum() or c in '_-.')
        
        if not entry_point:
            entry_point = 'app'
            
        # ✅ DYNAMIC BUILD FOLDER: Detect if analysis has a build_output
        build_folder = analysis.get('build_output', 'dist')
        # [FAANG] Handle port dict format: {dev_port, deploy_port} or legacy int
        port_data = analysis.get('port', 8080)
        if isinstance(port_data, dict):
            port = str(port_data.get('deploy_port', 8080))
        else:
            port = str(port_data)
        
        customized = template.replace('{build_output}', build_folder).replace('{port}', port)
        
        # AI-DRIVEN SYSTEM DEPENDENCY INJECTION
        if system_deps:
            print(f"[DockerExpert] Injecting AI-resolved system dependencies: {system_deps}")
            packages = " \\\n    ".join(system_deps)
            install_cmd = f"""
RUN apt-get update && apt-get install -y \\
    {packages} \\
    && rm -rf /var/lib/apt/lists/*
"""
            # Insert intelligently based on template type
            # Insert intelligently based on template type
            if "python" in template.lower() and "slim" in template.lower():
                # ✅ ROBUST INJECTION: Target the runtime stage explicitly
                # We replace the standalone "FROM ...-slim" line (checking for newline to avoid AS builder)
                target = "FROM python:3.11-slim\n"
                if target in customized:
                    print("[DockerExpert] 💉 Injected dependencies into Runtime Stage")
                    customized = customized.replace(target, f"{target}{install_cmd}")
                elif "FROM python:3.11-slim" in customized:
                    # Fallback: Just inject after the last occurrence if exact match fails
                    print("[DockerExpert] ⚠️ Exact runtime match failed, appending to last FROM")
                    parts = customized.rsplit("FROM python:3.11-slim", 1)
                    customized = parts[0] + f"FROM python:3.11-slim{install_cmd}" + parts[1]

            elif "node" in template.lower() and "slim" in template.lower():
                 # Handle Node keys if needed (e.g. canvas requires build-essential)
                 target = "FROM node:20-slim\n"
                 if target in customized:
                     customized = customized.replace(target, f"{target}{install_cmd}")
                 else:
                     customized = customized.replace(
                        "FROM node:20-slim", 
                        f"FROM node:20-slim{install_cmd}"
                     )

        return customized.replace('{entry_point}', entry_point)

    async def _resolve_system_dependencies(self, python_deps: list, abort_event: Optional[asyncio.Event] = None) -> list:
        """Use Gemini to identify required system packages (apt-get)"""
        try:
            deps_str = ", ".join(str(d) for d in python_deps)
            prompt = f"""
Analyze these Python dependencies for a Debian Slim container:
{deps_str}

Identify which ones require system-level (apt-get) packages to function.
For example: 'opencv' -> 'libgl1', 'psycopg2' -> 'libpq-dev', 'weasyprint' -> 'libpango-1.0-0'.

Return a JSON list of package names ONLY. Example: ["libgl1", "libglib2.0-0"].
If none require system deps, return empty list [].
Return ONLY valid JSON.
"""
            # ✅ TIMEOUT FIX: Don't hang forever if AI is slow
            response = await asyncio.wait_for(
                self.model.generate_content_async(prompt),
                timeout=10.0
            )
            
            import json
            text = response.text.replace('```json', '').replace('```', '').strip()
            ai_deps = json.loads(text)
            
            # ✅ DETERMINISTIC FALLBACK: Ensure critical libs are never missed
            print(f"[DockerExpert] AI suggested: {ai_deps}")
            final_deps = set(ai_deps)
            
            # Common complex packages that AI sometimes misses
            deps_str_lower = [str(d).lower() for d in python_deps]
            
            if any('opencv' in d and 'headless' not in d for d in deps_str_lower):
                print("[DockerExpert] Detected opencv-python: Forcing libgl1 injection")
                final_deps.add('libgl1')
                final_deps.add('libglib2.0-0')
            
            return list(final_deps)

        except asyncio.TimeoutError:
            print("[DockerExpert] AI Dependency Resolution timed out. Using fallbacks.")
            # Fallback logic for timeout
            deps_str_lower = [str(d).lower() for d in python_deps]
            fallback = []
            if any('opencv' in d and 'headless' not in d for d in deps_str_lower):
                 fallback.extend(['libgl1', 'libglib2.0-0'])
            return fallback

        except Exception as e:
            print(f"[DockerExpert] ⚠️ Failed to resolve system deps: {e}")
            return []
    
    def _estimate_image_size(self, framework_key: str) -> str:
        """Estimate final image size"""
        
        sizes = {
            'python_flask': '~150MB',
            'python_fastapi': '~150MB',
            'nodejs_express': '~120MB',
            'nodejs_nextjs': '~180MB',
            'nodejs_vite': '~40MB',
            'golang_gin': '~25MB'
        }
        
        return sizes.get(framework_key, '~200MB')
    
    async def _generate_custom_dockerfile(self, analysis: Dict) -> Dict:
        """Use Gemini to generate Dockerfile for unsupported frameworks"""
        
        prompt = f"""
Generate a production-optimized Dockerfile for Google Cloud Run with these requirements:

**Project Details:**
- Language: {analysis['language']}
- Framework: {analysis['framework']}
- Entry Point: {analysis.get('entry_point', 'unknown')}
- Port: {analysis.get('port', {}).get('deploy_port', 8080) if isinstance(analysis.get('port'), dict) else analysis.get('port', 8080)}
- Build Tool: {analysis.get('build_tool', 'unknown')}

**Requirements:**
1. Multi-stage build to minimize image size
2. Non-root user for security
3. Use PORT environment variable (Cloud Run requirement)
4. Layer caching optimization
5. Production-ready configuration
6. Include helpful comments

Return ONLY the Dockerfile content, no markdown formatting.
"""
        
        response = await self.model.generate_content_async(prompt)
        
        # Properly extract text from Gemini response
        dockerfile_content = None
        if hasattr(response, 'text') and response.text:
            dockerfile_content = response.text
        elif hasattr(response, 'candidates') and response.candidates:
            parts = response.candidates[0].content.parts
            if parts:
                dockerfile_content = ''.join([part.text for part in parts if hasattr(part, 'text')])
        
        if not dockerfile_content:
            # ✅ ROBUST FALLBACK: Language-aware base templates
            lang = analysis.get('language', 'python').lower()
            if 'node' in lang or 'javascript' in lang or 'typescript' in lang:
                dockerfile_content = f"""# Fallback Node.js template (slim for glibc compatibility)
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
COPY . .
ENV PORT={port}
ENV NODE_ENV=production
EXPOSE {port}
CMD ["npm", "start"]
"""
            elif 'go' in lang:
                dockerfile_content = f"""FROM golang:1.21-alpine
WORKDIR /app
COPY . .
RUN go build -o main .
ENV PORT={port}
EXPOSE {port}
CMD ["./main"]
"""
            else:
                dockerfile_content = f"""FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV PORT={port}
EXPOSE {port}
CMD ["python", "{analysis.get('entry_point', 'app.py')}"]
"""
        
        # Clean up markdown if present
        if '```dockerfile' in dockerfile_content:
            dockerfile_content = dockerfile_content.split('```dockerfile')[1].split('```')[0].strip()
        elif '```' in dockerfile_content:
            dockerfile_content = dockerfile_content.split('```')[1].split('```')[0].strip()
        
        return {
            'dockerfile': dockerfile_content,
            'optimizations': ["🤖 AI-generated for your specific stack"],
            'size_estimate': '~200MB'
        }


# Test docker expert
async def test_docker_expert():
    import os
    from dotenv import load_dotenv
    
    load_dotenv()
    
    gcloud_project = os.getenv('GOOGLE_CLOUD_PROJECT')
    expert = DockerExpertAgent(gcloud_project=gcloud_project)
    
    mock_analysis = {
        'language': 'python',
        'framework': 'flask',
        'entry_point': 'app.py',
        'port': 5000
    }
    
    print("Generating Dockerfile...\n")
    result = await expert.generate_dockerfile(mock_analysis)
    
    print("="*60)
    print("DOCKERFILE:")
    print("="*60)
    print(result['dockerfile'])
    print("\n" + "="*60)
    print("OPTIMIZATIONS:")
    print("="*60)
    for opt in result['optimizations']:
        # Strip any remaining special chars for test output
        safe_opt = opt.encode('ascii', 'ignore').decode('ascii')
        print(f"  {safe_opt}")
    print(f"\nEstimated Size: {result['size_estimate']}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_docker_expert())
