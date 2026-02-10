# DevGem Frontend

**Premium Dashboard & Chat Interface**

React 18 · TypeScript · Vite 5 · Tailwind CSS · Framer Motion

---

## Overview

The DevGem frontend is a glassmorphic, dark-mode-first dashboard built with React 18 and TypeScript. It provides the natural language deployment interface, real-time deployment visualization, environment variable management, and live log streaming — all connected to the backend via WebSocket.

---

## Quick Start

```bash
npm install
npm run dev
```

Runs at `http://localhost:5173`

**Environment Variables** — create `.env` in the project root:

```env
VITE_BACKEND_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

---

## Structure

```
src/
├── components/             97 UI components
│   ├── ChatWindow.tsx          AI chat interface with message streaming
│   ├── Dashboard.tsx           Deployment cards, status grid, analytics
│   ├── DeploymentStages.tsx    7-stage animated progress visualization
│   ├── EnvManager.tsx          Env var editor + Secret Manager sync
│   ├── LogViewer.tsx           Build & runtime log display
│   ├── Hero.tsx                Landing page hero
│   └── ui/                     Shadcn/ui primitives (40+ components)
│
├── contexts/               React contexts
│   ├── WebSocketContext.tsx     Connection + message routing
│   └── ThemeProvider.tsx        Dark/light theme management
│
├── hooks/                  7 custom hooks
│   ├── useWebSocket.ts         WebSocket connection management
│   └── useDeployment.ts        Deployment state & actions
│
├── lib/                    Core utilities
│   ├── WebSocketClient.ts      Typed WebSocket client (12+ event types)
│   └── api.ts                  REST API client
│
├── pages/                  12 pages
│   ├── Index.tsx               Landing page
│   ├── Dashboard.tsx           Main dashboard
│   └── Deploy.tsx              Deployment flow
│
└── types/                  TypeScript definitions
```

---

## Design System

| Principle | Implementation |
|:----------|:---------------|
| Dark mode first | Default dark theme with optional light |
| Glassmorphism | Frosted glass cards with `backdrop-blur` |
| Micro-animations | Framer Motion for transitions and interactions |
| Typography | Inter font family |
| Components | Shadcn/ui with custom theming |
| Spacing | Tailwind utility classes |

---

## WebSocket Protocol

Persistent connection with heartbeat, auto-reconnection, and typed message routing.

| Event | Purpose |
|:------|:--------|
| `message` | AI chat response |
| `analysis` | Code analysis results |
| `deployment_started` | Deployment initiated |
| `deployment_progress` | Stage updates with percentage |
| `deployment_update` | Status changes |
| `deployment_complete` | Final URL delivery |
| `ai_thought` | AI reasoning stream |
| `monitoring_alert` | Runtime health alerts |
| `ping` / `pong` | Keep-alive |

---

## Key Dependencies

| Package | Purpose |
|:--------|:--------|
| `react` 18 | UI framework |
| `react-router-dom` 6 | Client-side routing |
| `framer-motion` | Animations |
| `@tanstack/react-query` | Server state management |
| `react-markdown` | Markdown rendering in chat |
| `react-syntax-highlighter` | Code block highlighting |
| `recharts` | Dashboard analytics |
| `sonner` | Toast notifications |
| `lucide-react` | Icons |
| `canvas-confetti` | Deployment celebrations |
| `zod` | Runtime type validation |
| Shadcn/ui (Radix) | 40+ accessible UI primitives |

---

## Scripts

```bash
npm run dev       # Development server
npm run build     # Production build
npm run preview   # Preview production build
npm run lint      # ESLint
```

---

## By the Numbers

| | |
|:--|:--|
| Lines of Code | 12,000+ |
| Components | 97 |
| Pages | 12 |
| Custom Hooks | 7 |
| WebSocket Events | 12+ |

---

*Built with Gemini 3 for the Gemini 3 Global Hackathon*
