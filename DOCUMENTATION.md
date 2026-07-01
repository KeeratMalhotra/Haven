# Haven - AI-Powered Productivity Companion

## Live Demo
- **Application:** https://haven-412899276225.asia-south1.run.app
- **Backend API:** https://haven-backend-412899276225.asia-south1.run.app
- **GitHub Repository:** https://github.com/KeeratMalhotra/Haven

---

## Problem Statement Selected

**AI-powered productivity companion that proactively assists users in planning, prioritizing, and completing tasks before deadlines are missed.**

The modern professional juggles dozens of tasks, meetings, and commitments across multiple tools — yet 80% of people still miss deadlines, overcommit their days, and burn out from the cognitive load of self-managing their schedule. Traditional productivity apps are passive — they store information but don't think. They remind you of deadlines but don't help you act. They show your calendar but don't optimize it.

**Haven solves this by being the first productivity platform with a genuine AI brain — one that doesn't just store your tasks, but actively plans your day, learns your rhythms, protects your time, and speaks up before problems happen.**

---

## Solution Overview

Haven is an AI-powered productivity companion that moves beyond traditional reminders and task lists to become an intelligent chief of staff for your daily life. It combines:

1. **A conversational AI brain** powered by Google Gemini 2.5 Flash that understands natural language, learns user patterns over time, and makes proactive suggestions
2. **A premium, calm UI/UX** inspired by Notion and TickTick — matte, warm, aesthetically beautiful, designed to be a daily habit
3. **Deep Google Workspace integration** via Model Context Protocol (MCP) — Calendar, Tasks, Gmail, and Slides all connected natively
4. **Proactive intelligence** — the AI doesn't wait to be asked; it monitors your schedule, detects overcommitment, warns about approaching deadlines, and offers solutions before problems escalate

The platform is designed around one core loop: **"Tell it your day in plain words → it plans everything → it protects and adapts your schedule → you check it every morning like a ritual."**

---

## Key Features

### Core Productivity
- **Intelligent Task Management** — Full CRUD with Kanban board + List view, drag-and-drop between columns, inline editing, priority labels (high/medium/low), due dates, and subtask creation
- **Premium Calendar** — Month/Week/Day views with drag-to-reschedule, event editing, overlap detection with visual warnings, time-slot click to create, and real-time Google Calendar sync
- **Habit Tracking** — GitHub-style heat map visualization, streak rings, confetti check-in animations, daily/weekly/custom frequency, and auto-regeneration for recurring habits
- **Focus Mode / Pomodoro** — Countdown timer (25/45/60/90 min), ambient audio (rain/cafe/lo-fi via Web Audio API), growing plant SVG progress visualization, session stats, break mode transitions
- **Analytics Dashboard** — Pure SVG charts showing tasks completed per day, focus hours, habit completion rate, productivity score (0-100), time period selector

### AI Intelligence (The Brain)
- **Conversational Onboarding with Brain-Dump Parsing** — Users describe their week in natural language ("dentist Tuesday, finish report by Friday, gym 3x"); AI parses it into structured tasks, calendar events, and habits instantly using Gemini
- **Daily Morning Briefing** — AI-narrated summary of today's meetings, deadlines, top priority, and warnings (tight gaps, conflicts). One-tap actions: "Looks good" / "Plan my day" / "Adjust"
- **Proactive Intelligence Engine** — 5 conservative detectors that monitor your day:
  - Overcommitment catch (day has more hours committed than available)
  - Deadline trajectory warning (deadline won't fit remaining free time)
  - Pattern interruption (task repeatedly rescheduled → suggests better slot)
  - Recovery suggestion (evening, guilt-free redistribution of slipped tasks)
  - Protective buffer (back-to-back meetings → offers break insertion)
- **Governance Layer** — Frequency budget (max 3 nudges/day), never-during-focus suppression, learned calibration (adjusts based on accept/dismiss rate), quiet mode toggle
- **Persistent Memory & Behavioral Learning** — AI remembers productive hours, task patterns, estimate accuracy, vocabulary aliases, and adapts planning over time. Memory stored in Firestore, grows smarter with usage
- **Adaptive Planning** — Auto-Pilot uses learned memory to schedule deep work during YOUR productive hours, avoid times you always skip, and pad focus blocks when estimates run short
- **Context Chaining** — After completing an action, AI proposes the logical next step (email → task → calendar block → reminder)
- **AI Prioritization** — "Ask AI to Prioritize" reorders tasks by urgency x importance using Gemini analysis
- **Web Research for Tasks** — AI researches context relevant to any task (templates, approaches, key info) and presents expandable cards with summaries
- **Auto-Pilot Mode** — Two modes:
  - "Suggest Mode": AI plans the day, shows plan, waits for user approval
  - "Auto Mode": AI executes automatically with warning, then shows summary of changes
- **Template Library** — Pre-built workflows (Product Launch, Interview Prep, Weekly Review, Move to New City) + AI-generated custom templates from any goal description

### Integrations
- **Google Calendar** — Full CRUD sync (create, read, update, delete events) via MCP with `update_event` tool for in-place editing (preserves event IDs, no duplicates)
- **Google Tasks** — Full CRUD sync (create, read, update, delete, complete tasks) via MCP
- **Gmail Integration** — "Scan Inbox" extracts action items from emails using AI, suggests them as tasks. Thread-aware reply capability
- **Google Slides** — AI generates presentation outlines from task context, creates real Google Slides documents in user's Drive
- **Spotify** — Embedded playlist player for focus music, personalizable via playlist URL, suggested focus playlists (Lo-fi Beats, Deep Focus, Classical Focus)
- **Incremental OAuth** — Each service connects independently with scope-specific consent. Real-time connection status with scope equivalence detection (gmail.modify covers gmail.readonly + gmail.send)

### Communication & Notifications
- **Real-time WebSocket Chat** — Bidirectional communication with AI, markdown rendering (headings, code blocks, lists, tables, links), streaming token-by-token reveal
- **Notification Inbox** — Persistent Firestore-backed inbox with bell icon + unread count badge. Every AI nudge is archived with its one-tap action intact. Grouped Today/Earlier, mark-read, clear-all
- **Email Notifications** — 4-hour deadline reminders, optional daily digest, optional weekly review. Professional HTML templates via Gmail API
- **Voice Mode** — Web Speech API transcription → AI processing → response, inline within chat panel
- **Evening Reflection** — "How did today go? X of Y tasks done. Roll the rest to tomorrow?"

### User Experience
- **Premium Matte Theme** — Warm tinted-neutral palette (cream light mode, warm charcoal dark mode), Notion-style Inter font, 150ms micro-interactions, no hover-scale (calm like Linear)
- **Dark/Light Mode** — Full theme system with CSS variables, warm in both modes, accessible contrast (APCA-informed)
- **Universal Quick Capture** — Press "n" anywhere → command-style input → type naturally ("call dentist tomorrow 3pm") → creates task/event with natural date parsing
- **Cozy Landing Page** — Signature CSS/SVG scene (window at dusk, moonlit hills, desk, steaming mug, plant), three pillars, scroll-triggered reveals, emotional copy
- **Collapsible Sidebar** — Dashboard, Tasks, Calendar, Habits, Analytics, Planner, Settings. Spring-animated collapse (260px ↔ 68px), tooltip labels when collapsed
- **Engagement Streak System** — Tracks consecutive days of planning. "You've planned X days straight" — momentum/dopamine hook stored in Firestore
- **Offline Queue** — Tasks/Calendar changes saved locally when disconnected; syncs automatically on reconnection with "X changes pending sync" indicator
- **Integration-Aware UI** — Pages show connection status banners, disabled features prompt connection, AI brain knows what's connected and responds accordingly
- **Memory Transparency** — "What Haven knows about you" section in Settings showing all learned insights with per-item "Forget this" + "Clear all memory" for user trust and control
- **Custom Cursor System** — Pointer on interactive elements, grab on draggables, text on inputs, not-allowed on disabled
- **Error Boundaries** — React class-component error boundaries prevent single bad records from blanking entire pages
- **Progressive Disclosure** — Core features front and center; advanced features accessible but calm

### Security & Reliability
- **Multi-level Authentication** — Google OAuth 2.0 via NextAuth with server-side token verification on every API call
- **CSRF Protection** — HMAC-SHA256 signed state parameters for all OAuth flows (integration connections)
- **Prompt Injection Prevention** — All user-derived text passed to Gemini uses `system_instruction` separation with fenced opaque data blocks; rules never exposed to user content
- **Token Scope Verification** — Real-time scope checking via Google tokeninfo API with equivalence detection
- **Graceful Degradation** — Every AI call has deterministic fallbacks; Gemini failures never crash the system. Memory, proactive intelligence, and briefing all work without AI (just less polished)
- **Safe Date Handling** — `safeParseDate` / `safeFormat` utilities prevent "Invalid time value" crashes across the entire application
- **Input Validation** — Pydantic models on all backend endpoints with proper HTTP error codes
- **Rate Limiting Ready** — Architecture supports per-user rate limits on AI-heavy endpoints
- **Data Isolation** — Firestore queries scoped to authenticated user_id; cross-user access impossible
- **Token Revocation** — Disconnect buttons properly revoke tokens at the provider (Google/Spotify), not just locally
- **HTML Injection Prevention** — `html.escape()` on all user-derived content in email templates
- **Offline Resilience** — localStorage fallbacks for tasks, calendar, integration status; never shows blank pages
- **Error Recovery** — Error boundaries with "Retry" buttons, graceful empty states, never crashes from bad data
- **Production Docker Deployment** — Multi-stage Dockerfile, Cloud Run with auto-scaling, 1Gi memory, 300s timeout

---

## Technologies Used

### Frontend
| Technology | Purpose |
|-----------|---------|
| Next.js 15 (App Router) | Full-stack React framework with server-side rendering |
| React 19 | UI component library with latest features (Suspense, transitions) |
| TypeScript | Type-safe development across the entire frontend |
| Tailwind CSS 3.4 | Utility-first CSS framework with custom design tokens |
| Framer Motion 12 | Production-grade animation library (spring physics, layout animations) |
| Three.js + @react-three/fiber | 3D particle system entity for voice mode |
| @dnd-kit | Accessible drag-and-drop for tasks and calendar events |
| cmdk | Command palette / Quick Capture interface |
| date-fns | Lightweight date utility library |
| react-markdown + remark-gfm | Markdown rendering for AI responses |
| next-auth 4 | Authentication framework with Google OAuth provider |
| Web Audio API | Ambient sound generation (rain, cafe, lo-fi) for focus mode |
| Web Speech API | Voice transcription for hands-free interaction |
| Lucide React | Beautiful, consistent icon system |

### Backend
| Technology | Purpose |
|-----------|---------|
| Python 3.11 | Backend runtime |
| FastAPI | High-performance async API framework |
| Uvicorn | ASGI server with WebSocket support |
| WebSockets | Real-time bidirectional communication |
| Pydantic 2 | Data validation and serialization |
| HTTPX | Async HTTP client for external API calls |
| MCP (Model Context Protocol) | Standardized AI-tool communication protocol for Google service integration |

### Infrastructure
| Technology | Purpose |
|-----------|---------|
| Docker | Containerized deployment |
| Google Cloud Run | Serverless container hosting with auto-scaling |
| Google Cloud Build | CI/CD pipeline for Docker image building |
| Vercel | Frontend hosting with edge network |

---

## Google Technologies Utilized

| Google Technology | How We Use It |
|-------------------|---------------|
| **Google Gemini 2.5 Flash (via Vertex AI)** | Powers ALL AI features: intent analysis, task decomposition, scheduling optimization, proactive intelligence, brain-dump parsing, research generation, presentation outlines, email action extraction, daily briefing narration, copy polishing for nudges, template generation, priority ranking |
| **Google AI Studio** | Used during development for prompt engineering, testing Gemini responses, and iterating on system instructions for each agent |
| **Google Cloud Firestore** | Primary database for user profiles, tasks, habits, memory model, notifications, proactive state, engagement streaks, user preferences, and integration tokens |
| **Google Cloud Run** | Production backend hosting with auto-scaling, 1Gi memory allocation, asia-south1 region deployment |
| **Google Cloud Build** | Docker image building pipeline for Cloud Run deployment |
| **Google Calendar API (via MCP)** | Full calendar CRUD — list events, create events, update events (in-place), delete events, find free slots |
| **Google Tasks API (via MCP)** | Full task management — list tasks, create tasks, complete tasks, delete tasks |
| **Gmail API (via MCP)** | Inbox scanning for action items, email sending, thread-aware replies, notification emails (deadline reminders, daily digest, weekly review) |
| **Google Slides API** | Presentation generation — AI creates structured outlines, then builds real Google Slides documents in user's Drive |
| **Google OAuth 2.0** | Authentication and authorization with incremental scope consent for each service |
| **Google Cloud Text-to-Speech** | Voice synthesis for AI responses in voice mode |
| **Artifact Registry** | Docker image storage for Cloud Run deployments |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (Vercel)                         │
│  Next.js 15 + React 19 + TypeScript + Tailwind + Framer     │
│  ┌─────────────┬──────────┬──────────┬─────────────────┐    │
│  │  Dashboard  │  Tasks   │ Calendar │ Habits/Analytics │    │
│  └──────┬──────┴────┬─────┴────┬─────┴────────┬────────┘    │
│         │ WebSocket  │  REST    │  REST        │             │
└─────────┼────────────┼─────────┼──────────────┼─────────────┘
          │            │         │              │
┌─────────┼────────────┼─────────┼──────────────┼─────────────┐
│         ▼            ▼         ▼              ▼              │
│              BACKEND (Google Cloud Run)                       │
│  FastAPI + Uvicorn + WebSocket + Multi-Agent AI System       │
│  ┌────────────────────────────────────────────────────┐      │
│  │              AI ORCHESTRATOR (Gemini)               │      │
│  │  Routes to: Planner│Scheduler│Priority│Habits│     │      │
│  │  Email│Review│Voice│Proactive Intelligence│Memory  │      │
│  └──────────────────────┬─────────────────────────────┘      │
│                         │ MCP Protocol                        │
│  ┌──────────────────────┼─────────────────────────────┐      │
│  │         MCP SERVERS (subprocess)                    │      │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐       │      │
│  │  │ Calendar │ │  Tasks   │ │    Gmail     │       │      │
│  │  │   MCP    │ │   MCP    │ │     MCP      │       │      │
│  │  └─────┬────┘ └─────┬────┘ └──────┬───────┘       │      │
│  └────────┼─────────────┼─────────────┼───────────────┘      │
│           │             │             │                       │
└───────────┼─────────────┼─────────────┼───────────────────────┘
            │             │             │
┌───────────┼─────────────┼─────────────┼───────────────────────┐
│           ▼             ▼             ▼                       │
│              GOOGLE CLOUD PLATFORM                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐    │
│  │Firestore │ │ Vertex AI│ │  Gmail   │ │ Calendar API │    │
│  │(Database)│ │ (Gemini) │ │   API    │ │ + Tasks API  │    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘    │
└───────────────────────────────────────────────────────────────┘
```

---

## AI Agent Architecture

Haven uses a multi-agent system where each agent is a specialist:

| Agent | Responsibility |
|-------|---------------|
| **Orchestrator** | Intent analysis, routing, multi-agent coordination, context chaining |
| **Planner** | Task decomposition, CRUD, completion detection, recurring tasks |
| **Scheduler** | Calendar management, conflict detection, optimal slot finding, focus sessions |
| **Priority** | Urgency x importance ranking using tasks + calendar context |
| **Memory** | Behavioral observation, pattern distillation, adaptive insights |
| **Proactive Intelligence** | Overcommitment detection, deadline warnings, recovery suggestions |
| **Briefing** | Morning summaries, Tier 1 ambient observations |
| **Braindump** | Natural language parsing into structured tasks/events/habits |
| **Email** | Gmail scanning, action extraction, draft composition |
| **Review** | Weekly productivity analysis and trend reporting |
| **Voice** | Text-to-speech synthesis via Google Cloud TTS |
| **Notification** | Context-aware reminders with escalating urgency |
| **Habits** | Streak tracking, check-in management, frequency patterns |

---

## What Makes Haven Different

1. **The AI is the brain, not a chatbot** — It observes everything (drag-drop, completions, reschedules), learns patterns, and proactively helps. It doesn't wait to be asked.
2. **Genuine behavioral learning** — The more you use it, the smarter it gets about YOUR rhythms. This creates lock-in that competitors can't copy.
3. **Proactive intelligence with governance** — It speaks up, but respectfully. Frequency budget, never-during-focus, learned calibration, and always-actionable nudges. Silence is a feature.
4. **One magic loop** — Brain-dump your week → Haven plans everything → it protects and adapts → you check the briefing every morning like coffee.
5. **Production-grade reliability** — Error boundaries, safe date handling, offline queues, graceful AI fallbacks, multi-level authentication, and prompt injection prevention. Built to scale.

---

## Setup & Deployment

### Local Development
```bash
# Frontend
cd frontend && npm install && npm run dev

# Backend
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000
```

### Production
- Frontend: Vercel (automatic deploys from main branch)
- Backend: Google Cloud Run (Docker container, asia-south1 region)
- Database: Google Cloud Firestore (native mode)
- AI: Google Vertex AI (Gemini 2.5 Flash)

---

*Haven — Calm in the chaos.*
