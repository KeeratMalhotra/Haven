# Haven

AI-powered productivity companion that plans your day, manages tasks, and learns your rhythm.

Haven combines a clean, minimal dashboard with 9 specialist AI agents powered by Google Gemini 2.5 Flash. It helps you manage tasks, schedule events, track habits, handle email, create presentations, and stay productive through natural conversation.

## Accessing the Live App

**Live app (Google Cloud Run):** [https://haven-412899276225.asia-south1.run.app](https://haven-412899276225.asia-south1.run.app)

### Signing in 

1. Open the [live app URL](https://haven-412899276225.asia-south1.run.app) and click **Sign in with Google**.
2. Choose the Google account you want to use.
3. Google displays a **"Google hasn't verified this app"** screen. (This appears only because the app is in testing/unverified OAuth status — it is expected and safe to proceed.)
4. Click **Advanced** (bottom-left of that screen).
5. Click the **"Go to Haven (unsafe)"** link that appears.
6. On the consent screen, **review and ALLOW all the requested permissions**, then continue. 
7. You'll be redirected into the Haven. 🎉


## Architecture

```
Haven/
├── frontend/              # Next.js 15 + React 19 + TypeScript + Tailwind CSS
├── backend/               # Python FastAPI + WebSocket + AI agents (Vertex AI)
├── mcp-servers/           # Model Context Protocol servers
│   ├── google-calendar/   # Calendar API integration
│   ├── google-tasks/      # Tasks API integration
│   ├── google-gmail/      # Gmail API integration
│   └── google-slides/     # Slides API integration
├── shared/                # Shared Pydantic schemas
├── cloudbuild.yaml        # CI/CD auto-deploy to Cloud Run
└── docker-compose.yml     # Local development
```

## Tech Stack

### Frontend

| Technology | Purpose |
|------------|---------|
| Next.js 15 (App Router) | Framework with server components |
| React 19 | UI library |
| TypeScript | Type safety |
| Tailwind CSS | Custom dark/warm theme styling |
| Framer Motion | Animations and transitions |
| NextAuth.js | Google OAuth authentication |
| @dnd-kit | Drag-and-drop for kanban board |
| date-fns | Date manipulation |
| WebSocket | Real-time AI chat communication |

### Backend

| Technology | Purpose |
|------------|---------|
| Python 3.11 | Runtime |
| FastAPI | REST API and WebSocket server |
| Vertex AI (Gemini 2.5 Flash) | LLM for all AI agents |
| Google Cloud Firestore | Database and persistent storage |
| MCP (Model Context Protocol) | Tool access to Google services |

## AI Agents

Haven uses 9 specialist agents coordinated by an orchestrator:

| Agent | Role |
|-------|------|
| **Orchestrator** | Routes requests to the correct agent using intent analysis |
| **Planner** | Decomposes goals into subtasks, manages task lifecycle |
| **Scheduler** | Finds optimal time slots, manages calendar events |
| **Priority** | Analyzes and assigns task priorities based on context |
| **Notification** | Context-aware reminders with escalating urgency |
| **Voice** | Speech synthesis and voice interaction |
| **Email** | Gmail inbox scanning, composing, and drafting |
| **Habits** | Habit tracking with streaks and reminders |
| **Review** | Weekly productivity reviews and insights |

Additional intelligence systems:

- **Proactive Intelligence Engine** - anticipates needs and sends nudges before you ask
- **Persistent Memory** - learns your preferences, patterns, and working rhythm over time
- **Morning Briefing** - daily summary of schedule, tasks, and priorities

## MCP Servers

Each MCP server runs as a standalone subprocess and exposes tools via the Model Context Protocol:

| Server | Tools |
|--------|-------|
| google-calendar | List events, create, update, delete, find free slots |
| google-tasks | List tasks, create, update, complete, delete |
| google-gmail | List messages, read, send, draft, search |
| google-slides | Generate outline, create presentations |

## Key Features

- Brain-dump onboarding flow
- AI chat with 9 specialist agents
- Kanban board with drag-and-drop + list view
- Calendar integration with smart scheduling
- Habit tracking with streaks
- Gmail inbox scanning and email composition
- Google Slides presentation generation
- Morning briefing
- Proactive notifications
- Weekly productivity review
- Auto-Pilot mode
- Persistent memory and learning
- Voice mode
- Offline detection overlay
- Dark/light theme
- Pomodoro timer
- Command palette

## Prerequisites

- Node.js 22+
- Python 3.11+
- pnpm 10+
- Google Cloud project with Calendar, Tasks, Gmail, and Slides APIs enabled
- Vertex AI API enabled in your GCP project

## Setup

### 1. Clone and install

```bash
git clone <repository-url>
cd Haven

# Frontend
cd frontend
pnpm install

# Backend
cd backend
pip install -r requirements.txt

# MCP Servers
cd mcp-servers/google-calendar && pip install -r requirements.txt
cd mcp-servers/google-tasks && pip install -r requirements.txt
cd mcp-servers/google-gmail && pip install -r requirements.txt
cd mcp-servers/google-slides && pip install -r requirements.txt
```

### 2. Configure environment variables

**Backend** (`backend/.env`):

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 client secret |
| `GCP_PROJECT_ID` | Google Cloud project ID |
| `GCP_REGION` | Vertex AI region |
| `FRONTEND_ORIGIN` | Frontend URL for CORS |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL |
| `FIRESTORE_PROJECT_ID` | Firestore project ID |
| `GEMINI_MODEL` | Gemini model name (e.g. gemini-2.5-flash) |

**Frontend** (`frontend/.env.local`):

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth client ID (public) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID (server) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret (server) |
| `NEXTAUTH_SECRET` | NextAuth.js session encryption secret |
| `NEXTAUTH_URL` | Canonical URL of the app |
| `NEXT_PUBLIC_WS_URL` | WebSocket endpoint URL |

### 3. Run locally

**Using Docker Compose:**

```bash
docker compose up
```

**Or run individually:**

```bash
# Backend (starts MCP servers automatically)
cd backend
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
pnpm dev
```

## Authentication

Haven uses Google OAuth via NextAuth.js with the following scope model:

- **Mandatory scopes**: Google Calendar, Google Tasks, Google Slides
- **Optional scope**: Gmail (can be connected later from settings)

Users must grant the mandatory scopes on sign-in. Gmail can be connected or disconnected at any time from the integrations settings page.

## WebSocket Protocol

The frontend communicates with the AI backend over a persistent WebSocket connection.

### Client to Server

```json
{
  "type": "chat|voice",
  "content": "message text",
  "auth_token": "google-oauth-access-token"
}
```

### Server to Client

```json
{
  "type": "text|text_chunk|text_end|audio|status|task_update",
  "content": "response text or base64 audio",
  "agent": "orchestrator|planner|scheduler|priority|notification|voice|email|habits|review"
}
```

**Message types:**

| Type | Description |
|------|-------------|
| `text` | Complete text response |
| `text_chunk` | Streaming token (partial response) |
| `text_end` | End of streaming response |
| `audio` | Base64-encoded audio for voice mode |
| `status` | Agent status update (e.g. "Checking your calendar...") |
| `task_update` | Task was created, updated, or completed |

## Deployment

Haven is fully deployed on Google Cloud:

| Component | Service | Region |
|-----------|---------|--------|
| Frontend | Google Cloud Run | asia-south1 |
| Backend | Google Cloud Run | asia-south1 |
| Database | Google Cloud Firestore | asia-south1 |
| AI | Vertex AI (Gemini 2.5 Flash) | asia-south1 |
| Container Registry | Artifact Registry | asia-south1 |
| CI/CD | Cloud Build (auto-deploy on push to main) | asia-south1 |

The `cloudbuild.yaml` at the project root defines the full CI/CD pipeline — builds both frontend and backend Docker images, pushes to Artifact Registry, and deploys to Cloud Run automatically on every push to `main`.

## Security

- **OAuth 2.0 with scope enforcement** — Mandatory scope validation at sign-in; users cannot bypass required permissions
- **CSRF protection** — HMAC-SHA256 signed state parameters on all OAuth flows
- **Prompt injection prevention** — User-derived text isolated in fenced opaque data blocks; system instructions separated from user content
- **Data isolation** — All Firestore queries scoped to authenticated `user_id`; cross-user access impossible
- **Token revocation** — Disconnect flows properly revoke tokens at Google, not just locally
- **Input validation** — Pydantic models on all backend endpoints with proper HTTP error codes
- **Graceful degradation** — Every AI call has deterministic fallbacks; Gemini failures never crash the system

## Development

### Running lints and tests

```bash
# Frontend lint
cd frontend && pnpm lint

# Frontend tests
cd frontend && pnpm test

# Backend syntax check
cd backend && python -m py_compile app/main.py
```

### Adding a new AI agent

1. Create a new file in `backend/app/agents/`
2. Inherit from `AgentBase` in `backend/app/agents/base.py`
3. Implement the agent's execution logic
4. Register the agent in `backend/app/main.py` lifespan
5. Add routing rules in the orchestrator's system prompt

### Adding a new MCP server

1. Create a directory under `mcp-servers/` (e.g. `mcp-servers/my-service/`)
2. Follow the pattern in `mcp-servers/google-gmail/server.py`
3. Add the path config in `backend/app/config.py`
4. Register the server connection in `backend/app/main.py` lifespan

## License

MIT
