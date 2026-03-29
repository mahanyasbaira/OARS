# OARS — Architecture

**Last updated:** 2026-03-28
**Status:** Milestone 1 (project setup in progress)

---

## System Overview

OARS (Omnimodal Autonomous Research System) is a multi-agent research platform.
Architecture is directly inspired by Meta's TRIBE v2 tri-modal perception model.

```
┌─────────────────────────────────────────────────────────────────┐
│                        OARS Pipeline                            │
│                                                                 │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐                   │
│  │  Text    │   │  Audio   │   │  Vision  │  ← Perception Layer│
│  │  Agent   │   │  Agent   │   │  Agent   │                   │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘                   │
│       │              │              │                           │
│       └──────────────┴──────────────┘                          │
│                       │                                         │
│              ┌─────────▼─────────┐                             │
│              │  Temporal         │  ← Aggregation Layer        │
│              │  Aggregator       │                             │
│              └─────────┬─────────┘                             │
│                        │                                        │
│              ┌─────────▼─────────┐                             │
│              │  Translation /    │  ← Translation Layer        │
│              │  Report Agent     │                             │
│              └───────────────────┘                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Next.js (App Router) + TypeScript | Vercel deployment |
| Styling | Tailwind CSS + Shadcn/ui | |
| Auth | Clerk | No Supabase Auth |
| Database | Supabase PostgreSQL | Source of truth |
| Vector Store | pgvector (via Supabase) | Embeddings for retrieval |
| Object Storage | Cloudflare R2 | PDFs, audio, video, exports |
| AI Reasoning | Anthropic Claude | Synthesis + report generation |
| AI Multimodal | Google Gemini 1.5 Flash | Vision + audio extraction (free tier) |
| Email | Resend | Notifications |
| Background Jobs | Railway (persistent worker) | Long-running agent tasks |

---

## Directory Structure

```
OARS/
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── components/       # UI components (Shadcn-based)
│   ├── lib/              # Shared utilities (non-server)
│   ├── server/           # Server-only logic (DB queries, auth checks)
│   ├── agents/           # Agent definitions and orchestration
│   ├── schemas/          # Zod schemas and shared TypeScript types
│   └── workers/          # Background job logic
├── db/
│   └── migrations/       # SQL migration files
├── docs/                 # Project documentation
│   ├── architecture.md   # This file
│   ├── changelog.md
│   └── roadmap.md
└── public/               # Static assets
```

---

## Core Domain Entities

| Entity | Description |
|--------|-------------|
| `users` | Synced from Clerk via webhook |
| `projects` | Top-level container for research work |
| `sources` | Uploaded files or linked content (PDF, audio, video) |
| `uploads` | Raw file metadata (R2 key, mime type, size) |
| `extractions` | Structured output from an agent run against a source |
| `timeline_events` | Normalized events with timestamps, traceable to extractions |
| `claims` | Factual statements with provenance |
| `reports` | Final generated output, linked to project |
| `jobs` | Async job lifecycle (queued → running → completed/failed) |
| `agent_runs` | Individual agent execution records |

---

## Agent Output Schema (shared across all agents)

Every agent must emit a payload conforming to:

```typescript
{
  sourceId: string
  projectId: string
  modality: "text" | "audio" | "vision"
  contentSpan: { start: number; end: number }   // byte or time range
  timeRange: { from: string | null; to: string | null }
  entities: Entity[]
  claims: Claim[]
  events: TimelineEvent[]
  evidence: Evidence[]
  confidence: number                              // 0-1
  promptVersion: string
  model: string
  createdAt: string
}
```

---

## Background Job Lifecycle

```
queued → running → completed
                 ↘ failed → (retry with backoff)
                 ↘ cancelled
```

---

## Milestones

See `roadmap.md` for current milestone targets.
