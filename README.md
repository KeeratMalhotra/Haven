# Haven (Previously ChronAI)

AI-powered productivity companion with a living particle UI entity.

ChronAI combines a visually stunning Three.js particle system with intelligent AI agents powered by Google Gemini 2.5 Flash. It helps you manage tasks, schedule events, and stay productive through natural conversation.

## Architecture

```
ChronAI/
├── frontend/          # Next.js 15 App Router + Three.js particle entity
├── backend/           # Python FastAPI + WebSocket + AI agents
├── mcp-servers/       # Model Context Protocol servers
│   ├── google-calendar/   # Calendar API integration
│   └── google-tasks/      # Tasks API integration
├── shared/            # Shared schemas and types
└── docker-compose.yml # Container orchestration
```

### Frontend
- Next.js 15 with App Router and TypeScript
- Three.js particle system with custom GLSL shaders (3000+ particles)
- Real-time WebSocket communication
- Google OAuth via NextAuth.js
- Tailwind CSS with dark neon theme

### Backend
- FastAPI with WebSocket endpoint for real-time chat
- Modular AI agents with base class pattern:
  - **Orchestrator**: Routes requests using Gemini intent analysis
  - **Planner**: Decomposes goals into subtasks
  - **Scheduler**: Finds optimal time slots
  - **Notification**: Context-aware reminders with escalating urgency
  - **Voice**: Google Cloud TTS for speech synthesis
- MCP client for tool access to Google services

### MCP Servers
- Standalone Python packages using the `mcp` library
- Google Calendar: list, create, find free slots, delete events
- Google Tasks: list, create, update, complete, delete tasks

## Prerequisites

- Node.js 22+
- Python 3.9+
- pnpm 10+
- Google Cloud project with Calendar and Tasks APIs enabled
- Gemini API key

## Setup

### 1. Clone and install

```bash
# Frontend
cd frontend
pnpm install

# Backend
cd backend
pip install -r requirements.txt

# MCP Servers
cd mcp-servers/google-calendar
pip install -r requirements.txt

cd mcp-servers/google-tasks
pip install -r requirements.txt
```

### 2. Configure environment variables

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your credentials

# Frontend
cp frontend/.env.example frontend/.env.local
# Edit frontend/.env.local with your credentials
```

### 3. Run with Docker Compose

```bash
docker compose up
```

Or run individually:

```bash
# Backend
cd backend
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
pnpm dev
```

## WebSocket Protocol

### Client to Server
```json
{
  "type": "chat|voice",
  "content": "message text",
  "auth_token": "google-oauth-token"
}
```

### Server to Client
```json
{
  "type": "text|audio|task_update",
  "content": "response text or base64 audio",
  "agent": "orchestrator|planner|scheduler|notification|voice"
}
```

## Environment Variables

### Backend (`backend/.env`)
| Variable | Description |
|----------|-------------|
| GOOGLE_CLIENT_ID | Google OAuth 2.0 client ID |
| GOOGLE_CLIENT_SECRET | Google OAuth 2.0 client secret |
| GCP_PROJECT_ID | Google Cloud project ID |
| GCP_REGION | Vertex AI region (default: us-central1) |

### Frontend (`frontend/.env.local`)
| Variable | Description |
|----------|-------------|
| NEXT_PUBLIC_GOOGLE_CLIENT_ID | Google OAuth client ID (public) |
| NEXTAUTH_SECRET | NextAuth.js session encryption secret |
| NEXT_PUBLIC_WS_URL | WebSocket endpoint URL |

## Development

### Running tests
```bash
# Frontend
cd frontend && pnpm lint

# Backend (syntax check)
cd backend && python -m py_compile app/main.py
```

### Adding a new agent

1. Create a new file in `backend/app/agents/`
2. Inherit from `AgentBase`
3. Implement `async execute(task: dict) -> dict`
4. The agent auto-registers on instantiation
5. Add initialization in `backend/app/main.py` lifespan

## License

MIT
