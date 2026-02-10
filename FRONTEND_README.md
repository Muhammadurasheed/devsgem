<![CDATA[<div align="center">

# 💎 DevGem Frontend

### Premium Dashboard & Chat Interface — React + TypeScript

[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

</div>

---

## Overview

The DevGem frontend is a **glassmorphic, dark-mode-first dashboard** built with React 18, TypeScript, and Tailwind CSS. It provides the natural language deployment interface, real-time deployment visualization, environment variable management, and live log streaming — all connected to the backend via WebSocket.

---

## ⚡ Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

Development server runs at `http://localhost:5173`

### Environment Variables

Create `.env` in the project root:

```bash
VITE_BACKEND_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

---

## 🏗️ Architecture

```
src/
├── components/          # 97 UI components
│   ├── ChatWindow.tsx       # AI chat interface with message streaming
│   ├── Dashboard.tsx        # Deployment cards, status grid, analytics
│   ├── DeploymentStages.tsx # 7-stage animated progress visualization
│   ├── EnvManager.tsx       # Environment variable editor + Secret Manager sync
│   ├── LogViewer.tsx        # Build & runtime log display
│   ├── Hero.tsx             # Landing page hero section
│   ├── Footer.tsx           # Footer with branding
│   ├── Logo.tsx             # Animated logo component
│   └── ui/                  # Shadcn/ui primitives (40+ components)
│
├── contexts/            # React contexts
│   ├── WebSocketContext.tsx  # WebSocket connection + message routing
│   └── ThemeProvider.tsx     # Dark/light theme management
│
├── hooks/               # Custom React hooks
│   ├── useWebSocket.ts      # WebSocket connection management
│   ├── useDeployment.ts     # Deployment state & actions
│   └── ...
│
├── lib/                 # Core utilities
│   ├── WebSocketClient.ts   # Typed WebSocket client (12+ event types)
│   ├── api.ts               # REST API client
│   ├── utils.ts             # Shared utilities
│   └── ...
│
├── pages/               # 12 page components
│   ├── Index.tsx            # Landing page
│   ├── Dashboard.tsx        # Main dashboard
│   ├── Deploy.tsx           # Deployment flow
│   ├── Settings.tsx         # User preferences
│   └── ...
│
├── types/               # TypeScript definitions
│   ├── deployment.ts        # Deployment types
│   └── websocket.ts         # WebSocket message types
│
├── App.tsx              # Root component + routing
├── main.tsx             # Entry point
└── index.css            # Global styles + design system
```

---

## 🎨 Design System

- **Dark mode first** with optional light theme
- **Glassmorphism** — Frosted glass card effects with backdrop-blur
- **Micro-animations** powered by Framer Motion
- **Premium typography** — Inter font family
- **Consistent spacing** via Tailwind utility classes
- **Component library** — Shadcn/ui with custom theming

---

## 🌐 Real-Time Communication

The frontend maintains a persistent WebSocket connection to the backend with:

- **Heartbeat protocol** — ping/pong keep-alive to detect stale connections
- **Auto-reconnection** — Exponential backoff with jitter on disconnect
- **Typed message protocol** — 12+ event types for type-safe handling:

```typescript
type WebSocketEventType =
  | 'message'           // AI chat response
  | 'analysis'          // Code analysis results
  | 'deployment_started'// Deployment initiated
  | 'deployment_progress'// Stage updates with percentage
  | 'deployment_update' // Status changes
  | 'deployment_complete'// Final URL delivery
  | 'ai_thought'        // AI reasoning stream
  | 'monitoring_alert'  // Runtime health alerts
  | 'connected'         // Connection established
  | 'error'             // Error notification
  | 'ping' | 'pong'     // Keep-alive
```

---

## 📦 Key Dependencies

| Package | Purpose |
|---------|---------|
| `react` 18 | UI framework |
| `react-router-dom` 6 | Client-side routing |
| `framer-motion` | Animations and transitions |
| `@tanstack/react-query` | Server state management |
| `react-markdown` + `remark-gfm` | Markdown rendering in chat |
| `react-syntax-highlighter` | Code block highlighting |
| `recharts` | Dashboard analytics charts |
| `sonner` | Toast notifications |
| `lucide-react` | Icon library |
| `canvas-confetti` | Deployment celebration 🎉 |
| `zod` | Runtime type validation |
| `tailwind-merge` + `clsx` | Conditional class merging |
| `shadcn/ui` (Radix primitives) | 40+ accessible UI components |

---

## 📊 Metrics

| Metric | Value |
|--------|-------|
| Total Lines of Code | 12,000+ |
| UI Components | 97 |
| Page Components | 12 |
| Custom Hooks | 7 |
| WebSocket Event Types | 12+ |
| Shadcn/ui Primitives | 40+ |

---

## 🛠️ Scripts

```bash
npm run dev       # Start dev server (Vite)
npm run build     # Production build
npm run preview   # Preview production build
npm run lint      # ESLint
```

---

<div align="center">

**Built with Gemini 3 for the Gemini 3 Global Hackathon**

</div>
]]>
