<![CDATA[<div align="center">

# 💎 DevGem Backend

### AI-Powered Deployment Engine — Built with Gemini 3

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![Gemini 3](https://img.shields.io/badge/Gemini%203-Pro%20%2B%20Flash-4285F4?style=flat-square&logo=google&logoColor=white)](https://deepmind.google/technologies/gemini/)

</div>

---

## Overview

The DevGem backend is a **FastAPI-based agentic deployment engine** that orchestrates 7 specialized AI agents and 24 cloud services to deploy any GitHub repository to Google Cloud Run — entirely through natural language.

**No gcloud CLI.** Everything is done via Google Cloud Python client libraries and REST APIs.

---

## 🤖 AI Agent System

| Agent | Model | Lines | Purpose |
|-------|-------|-------|---------|
| **OrchestratorAgent** | `gemini-3-pro-preview` | 4,765 | Central coordinator with Gemini function calling. Routes user requests, manages context, orchestrates the deployment pipeline |
| **CodeAnalyzerAgent** | `gemini-3-flash-preview` | 841 | Dual-phase analysis: rule-based heuristic engine (25+ framework signatures) + Gemini validation. Detects language, framework, ports, dependencies, entry points |
| **DockerExpertAgent** | `gemini-3-flash-preview` | 736 | Generates production-optimized Dockerfiles from 15+ templates. Uses Gemini for native library resolution (e.g., `opencv` → `libgl1`) |
| **GeminiBrainAgent** | `gemini-3-pro-preview` | 870 | Autonomous error diagnosis with root cause analysis and code fix generation. Three-tier fallback (Vertex Pro → Vertex Flash → Gemini API) |
| **MonitoringAgent** | `gemini-3-flash-preview` | 190 | Runtime health analysis, deployment monitoring, performance recommendations |
| **GeminiFixHandler** | `gemini-3-flash-preview` | 165 | Applies AI-generated code fixes to source files |
| **GeminiTools** | — | 160 | Function declarations for Gemini's function calling capabilities |

---

## 🔧 Services (24 Modules)

| Service | Purpose |
|---------|---------|
| `gcloud_service.py` | **Core** — Cloud Build, Cloud Run v2, Artifact Registry, IAM, Secret Manager. 2,541 lines of FAANG-level GCP integration |
| `deployment_service.py` | Deployment lifecycle management, state persistence, status tracking |
| `secret_sync_service.py` | Two-way env var synchronization: Dashboard ↔ Secret Manager ↔ Cloud Run |
| `github_service.py` | GitHub API integration, repository management, OAuth token handling |
| `github_auth.py` | GitHub OAuth flow (authorization, token exchange, user profile) |
| `session_store.py` | In-memory session management with context isolation |
| `sqlite_session_store.py` | Persistent session storage with SQLite |
| `deployment_progress.py` | Real-time progress engine with monotonic boosting |
| `branding_service.py` | Framework logo detection and brand asset resolution |
| `health_check.py` | Post-deployment health verification with TCP probes |
| `security.py` | Security scanning, Dockerfile validation, env var sanitization |
| `optimization.py` | Container optimization recommendations |
| `monitoring.py` | Cloud Logging integration for runtime log retrieval |
| `preview_service.py` | Deployment screenshot generation via Playwright |
| `docker_service.py` | Local Docker operations and image management |
| `analysis_service.py` | Code analysis coordination and caching |
| `cloud_storage_service.py` | GCS operations for source uploads and log retrieval |
| `domain_service.py` | Custom domain mapping for Cloud Run services |
| `source_control_service.py` | Git operations, repo cloning, branch management |
| `google_auth.py` | Google OAuth integration |
| `user_service.py` | User profile management and authentication |
| `usage_service.py` | API usage tracking and rate limiting |
| `preferences_service.py` | User preference storage |
| `__init__.py` | Service registry and initialization |

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure Environment

Create `.env` in the `backend/` directory:

```bash
# Google Cloud (Required)
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_REGION=us-central1
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json

# Gemini AI (Required)
GEMINI_API_KEY=your-gemini-api-key

# GitHub OAuth (Required for repo access)
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_TOKEN=your-github-pat

# Optional
FRONTEND_URL=http://localhost:5173
```

### 3. Enable GCP APIs

```bash
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudresourcemanager.googleapis.com \
  logging.googleapis.com
```

### 4. Run

```bash
python app.py
```

Server starts at `http://localhost:8000`

---

## 🌐 API Reference

### HTTP Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Root endpoint |
| `GET` | `/health` | Health check (Cloud Run compatible) |
| `POST` | `/chat` | Send message to AI (non-streaming) |
| `GET` | `/stats` | Service statistics & metrics |
| `GET` | `/api/deployments` | List user deployments |
| `GET` | `/api/deployments/{id}` | Get deployment details |
| `GET` | `/api/deployments/{id}/logs` | Get build/runtime logs |
| `GET` | `/api/deployments/{id}/env` | Get environment variables |
| `POST` | `/api/deployments/{id}/env` | Update environment variables |
| `POST` | `/api/deployments/{id}/abort` | Abort active deployment |
| `GET` | `/auth/github/callback` | GitHub OAuth callback |

### WebSocket

| Path | Description |
|------|-------------|
| `WS /ws/chat` | Real-time bidirectional communication |

**Message Types:** `message`, `analysis`, `deployment_started`, `deployment_progress`, `deployment_update`, `deployment_complete`, `ai_thought`, `monitoring_alert`, `ping`/`pong`

---

## 🏗️ The 7-Stage Deployment Pipeline

```
1. Repository Access    → git clone --depth 1 (authenticated)
2. Code Analysis        → Heuristic engine + Gemini validation
3. Dockerfile Generation→ Template matching + native lib resolution
4. Environment Config   → .env parsing + Secret Manager sync
5. Security Scan        → Dockerfile + env var validation
6. Container Build      → Cloud Build + Kaniko (no Docker daemon)
7. Cloud Run Deploy     → Cloud Run v2 API + IAM automation
```

Each stage streams real-time progress, logs, and AI reasoning via WebSocket.

---

## 🔑 Key Technical Decisions

- **`node:20-slim` over `node:20-alpine`** — Alpine uses `musl` not `glibc`, causing silent failures with native modules (`bcrypt`, `sharp`, `canvas`)
- **Kaniko over Docker-in-Docker** — No privileged container access needed. Secure, daemon-less image construction
- **True Remote Build** — Cloud Build clones directly from GitHub. No local tarball uploads. Language-aware "healing files" are injected via base64 echo steps
- **TCP startup probes over HTTP** — We can't assume the app serves `/`. TCP verifies the port is listening regardless of framework routing
- **Dual-port sensing** — `dev_port` for local development, `deploy_port` (always 8080) for Cloud Run compliance
- **Monotonic progress boosting** — Progress bar never goes backward. Time-based virtual increments prevent UI stalling during long build steps

---

## 🛡️ Resilience Patterns

- **Multi-region Gemini failover** across 4 Vertex AI regions + direct API fallback
- **Exponential backoff with jitter** on all API calls
- **Abort event propagation** — User cancellation instantly stops all agents and GCP operations via `asyncio.Event`
- **Session rehydration** — State persists across page refreshes via SQLite
- **IAM propagation verification** — Polls the deployed URL until it's publicly accessible before returning

---

## 📊 Metrics

| Metric | Value |
|--------|-------|
| Total Lines of Code | 15,000+ |
| AI Agent Modules | 7 |
| Cloud Service Modules | 24 |
| Dockerfile Templates | 15+ |
| Framework Signatures | 25+ |
| Supported Languages | Python, Node.js, Go, PHP, Ruby, Java |
| GCP APIs Integrated | 8 |

---

<div align="center">

**Built with Gemini 3 for the Gemini 3 Global Hackathon**

</div>
]]>
