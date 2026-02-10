<![CDATA[<div align="center">

# 💎 DevGem

### The Sovereign Agentic Cloud Engine

**Deploy any GitHub repository to Google Cloud Run through natural language.**

[![Built with Gemini 3](https://img.shields.io/badge/Built%20with-Gemini%203-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://deepmind.google/technologies/gemini/)
[![Cloud Run](https://img.shields.io/badge/Cloud%20Run-Serverless-34A853?style=for-the-badge&logo=googlecloud&logoColor=white)](https://cloud.google.com/run)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)

---

*Paste a GitHub URL. Say "Deploy." Get a live Cloud Run URL in minutes.*

*No Dockerfiles. No CLI. No config files. Just conversation.*

</div>

---

## 🚀 What is DevGem?

DevGem is a **fully autonomous, AI-powered deployment platform** that transforms the Cloud Run deployment experience from a multi-step manual DevOps process into a single natural language conversation.

Five specialized **Gemini 3 AI agents** collaborate in real-time to:

1. **Clone** your repository from GitHub
2. **Analyze** your codebase across 25+ framework signatures
3. **Generate** production-optimized Dockerfiles with native library resolution
4. **Build** container images in the cloud using Kaniko (no Docker daemon required)
5. **Deploy** to Google Cloud Run with auto-scaling, HTTPS, and IAM policy automation
6. **Stream** real-time build logs, AI reasoning, and deployment progress via WebSocket

**Zero gcloud CLI dependency** — everything uses Google Cloud Python client libraries.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React + TypeScript)          │
│  ┌──────────┐  ┌───────────┐  ┌────────────────────┐    │
│  │   Chat   │  │ Dashboard │  │ Environment Manager│    │
│  │ Interface │  │  + Logs   │  │   + Secret Sync    │    │
│  └────┬─────┘  └─────┬─────┘  └────────┬───────────┘    │
│       └───────────────┼────────────────┘                 │
│                       │ WebSocket                        │
└───────────────────────┼──────────────────────────────────┘
                        │
┌───────────────────────┼──────────────────────────────────┐
│                  Backend (FastAPI + Python)               │
│                       │                                  │
│  ┌────────────────────▼─────────────────────────────┐    │
│  │            OrchestratorAgent (Gemini 3 Pro)       │    │
│  │         Function Calling · Context Management     │    │
│  └──┬──────────┬──────────┬──────────┬──────────┘    │
│     │          │          │          │                │
│  ┌──▼──┐  ┌───▼───┐  ┌──▼───┐  ┌──▼──────────┐     │
│  │Code │  │Docker │  │Gemini│  │ Monitoring  │     │
│  │Analy│  │Expert │  │Brain │  │   Agent     │     │
│  │zer  │  │Agent  │  │Agent │  │             │     │
│  └──┬──┘  └───┬───┘  └──┬───┘  └─────────────┘     │
│     │         │         │                            │
│  ┌──▼─────────▼─────────▼────────────────────────┐   │
│  │              Google Cloud Services             │   │
│  │  Cloud Build · Cloud Run · Artifact Registry   │   │
│  │  Secret Manager · Cloud Storage · Cloud Logging│   │
│  └────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

---

## 🤖 Gemini 3 Integration

DevGem uses **Gemini 3** as its core intelligence layer across every agent:

| Agent | Model | Purpose |
|-------|-------|---------|
| **OrchestratorAgent** | `gemini-3-pro-preview` | Function calling, deployment orchestration, natural language routing |
| **GeminiBrainAgent** | `gemini-3-pro-preview` | Error diagnosis, root cause analysis, code fix generation |
| **CodeAnalyzerAgent** | `gemini-3-flash-preview` | Framework validation, port detection, deployment readiness scoring |
| **DockerExpertAgent** | `gemini-3-flash-preview` | Native library resolution (`opencv` → `libgl1`), custom Dockerfile generation |
| **MonitoringAgent** | `gemini-3-flash-preview` | Runtime health analysis, performance recommendations |

**Multi-region failover**: `us-central1` → `us-east1` → `europe-west1` → `asia-northeast1` → direct Gemini API.

---

## ⚡ Quick Start

### Prerequisites

- **Node.js 18+** (frontend)
- **Python 3.11+** (backend)
- **Google Cloud Project** with billing enabled
- **GitHub Account** (for OAuth integration)

### Frontend

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open `http://localhost:5173`

### Backend

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Configure environment (create .env file)
cp .env.example .env
# Edit .env with your credentials

# Start server
python app.py
```

Server runs at `http://localhost:8000`

### Environment Variables

Create `backend/.env`:

```bash
# Google Cloud
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_REGION=us-central1
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json

# Gemini AI
GEMINI_API_KEY=your-gemini-api-key

# GitHub OAuth
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_TOKEN=your-github-token

# Frontend
VITE_BACKEND_URL=http://localhost:8000
```

---

## 📂 Project Structure

```
devsgem/
├── src/                          # Frontend (React + TypeScript)
│   ├── components/               # 97 UI components
│   │   ├── ChatWindow.tsx        # AI chat interface
│   │   ├── Dashboard.tsx         # Deployment management
│   │   ├── DeploymentStages.tsx  # 7-stage progress visualization
│   │   ├── EnvManager.tsx        # Environment variable editor
│   │   └── ...
│   ├── contexts/                 # React contexts (WebSocket, Theme)
│   ├── hooks/                    # Custom React hooks
│   ├── lib/                      # Utilities, WebSocket client
│   ├── pages/                    # 12 page components
│   └── types/                    # TypeScript type definitions
│
├── backend/                      # Backend (FastAPI + Python)
│   ├── agents/                   # 7 AI agent modules
│   │   ├── orchestrator.py       # Central agent coordinator (4,765 lines)
│   │   ├── code_analyzer.py      # Framework & dependency detection
│   │   ├── docker_expert.py      # Dockerfile generation engine
│   │   ├── gemini_brain.py       # Error diagnosis & code fixing
│   │   ├── gemini_tools.py       # Function declarations for Gemini
│   │   ├── monitoring_agent.py   # Runtime health monitoring
│   │   └── gemini_fix_handler.py # Code fix application
│   ├── services/                 # 24 cloud & platform services
│   │   ├── gcloud_service.py     # Cloud Run/Build/IAM integration
│   │   ├── deployment_service.py # Deployment lifecycle manager
│   │   ├── secret_sync_service.py# Secret Manager sync engine
│   │   ├── github_service.py     # GitHub API integration
│   │   └── ...
│   ├── app.py                    # FastAPI entry point (2,992 lines)
│   └── requirements.txt          # Python dependencies
│
├── package.json                  # Frontend dependencies
└── vite.config.ts                # Vite configuration
```

---

## 🛠️ Tech Stack

### Frontend
React 18 · TypeScript · Vite 5 · Tailwind CSS · Shadcn/ui · Framer Motion · WebSocket

### Backend
Python 3.11 · FastAPI · Vertex AI SDK · google-cloud-build · google-cloud-run · google-cloud-storage · google-cloud-secret-manager · SQLite + aiosqlite

### Cloud Infrastructure
Cloud Run · Cloud Build + Kaniko · Artifact Registry · Secret Manager · Cloud Storage · Cloud Logging

---

## 📊 Metrics

| Metric | Value |
|--------|-------|
| Backend Code | 15,000+ lines |
| Frontend Code | 12,000+ lines |
| AI Agent Modules | 7 |
| Cloud Services | 24 |
| UI Components | 97 |
| Dockerfile Templates | 15+ |
| Framework Signatures | 25+ |
| Deployment Time | 3–5 minutes |

---

## 📄 License

This project was built for the **Gemini 3 Global Hackathon** by Google DeepMind.

---

<div align="center">

**Built with 💎 by the DevGem Team**

*Where Google-Scale Engineering Meets Apple-Grade Design*

</div>
]]>
