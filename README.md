# OARS — Omnimodal Autonomous Research System

> Upload documents, audio, and video. Get a unified, cited, contradiction-aware research brief in minutes.

---

## The Problem

Research is broken for anyone working with large volumes of mixed-media sources.

A journalist investigating a story has 40 PDFs, 12 interview recordings, and hours of video footage. A law student is cross-referencing 20 case documents and lecture notes. A policy analyst is synthesising government reports, academic papers, and news transcripts. A student trying to understand a semester's worth of material across slides, textbooks, and recorded lectures.

In every case, the process is the same: read everything, take notes, try to remember what said what, manually build a timeline, and hope you didn't miss a contradiction buried on page 34 of document 17.

That process is slow, error-prone, and scales terribly. OARS fixes it.

---

## What OARS Does

You create a project, upload your sources — PDFs, audio files, videos, markdown — and OARS does the rest:

1. **Extracts** structured knowledge from every source (entities, claims, events, key evidence)
2. **Aggregates** all events into a single chronological timeline across all sources
3. **Flags contradictions** when two sources disagree on facts or dates
4. **Generates reports** — executive summaries, timeline reports, contradiction matrices — with full citations back to the original source

Everything is traceable. Every claim links back to the exact passage it came from.

---

## Real-World Use Cases

| Who | Problem | What OARS produces |
|-----|---------|-------------------|
| Investigative journalists | 60 leaked documents, 3 weeks to read | Timeline of events + contradiction report in 20 minutes |
| Law students | 25 case files, exam tomorrow | Entity map + key claims per case, sorted by theme |
| Policy analysts | 10 government reports + academic papers | Unified chronology + where the reports disagree |
| PhD researchers | Literature review across 50 papers | Evidence map, conflicting claims, research gaps |
| Medical students | Lecture recordings + textbook chapters | Merged timeline of disease progression, conflicting treatment claims flagged |

---

## Architecture

OARS is built on a three-layer AI pipeline, inspired by Meta's TRIBE v2 tri-modal perception architecture:

```
┌─────────────────────────────────────────────────────────┐
│                    Perception Layer                      │
│                                                         │
│   ┌───────────┐   ┌───────────┐   ┌───────────┐        │
│   │   Text    │   │   Audio   │   │  Vision   │        │
│   │   Agent   │   │   Agent   │   │   Agent   │        │
│   │  (PDF/MD) │   │  (MP3/WAV)│   │ (MP4/IMG) │        │
│   └─────┬─────┘   └─────┬─────┘   └─────┬─────┘        │
│         └───────────────┴───────────────┘               │
│                          │                               │
├──────────────────────────┼──────────────────────────────┤
│                 Aggregation Layer                        │
│                          │                               │
│            ┌─────────────▼────────────┐                 │
│            │   Temporal Aggregator    │                 │
│            │  merge · deduplicate     │                 │
│            │  detect contradictions   │                 │
│            └─────────────┬────────────┘                 │
│                          │                               │
├──────────────────────────┼──────────────────────────────┤
│                 Translation Layer                        │
│                          │                               │
│            ┌─────────────▼────────────┐                 │
│            │      Report Agent        │                 │
│            │  executive summary       │                 │
│            │  timeline report         │                 │
│            │  contradiction matrix    │                 │
│            └──────────────────────────┘                 │
└─────────────────────────────────────────────────────────┘
```

Each perception agent runs independently and in parallel. The aggregator merges their output into a unified knowledge graph. The report agent translates that into human-readable research briefs.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS + Shadcn/ui |
| Auth | Clerk |
| Database | Supabase (PostgreSQL + pgvector) |
| Object Storage | Cloudflare R2 |
| AI — Multimodal | Google Gemini 2.5 Flash |
| Email | Resend |

All AI work runs on free-tier APIs during development.

---

## Current Status

| Milestone | Status |
|-----------|--------|
| 1 — Auth, Projects, File Upload | ✅ Complete |
| 2 — Text Extraction Pipeline | ✅ Complete |
| 3 — Timeline Aggregation | ✅ Complete |
| 4 — Audio + Vision Agents, Reports | In progress |
| 5 — Production Hardening | Upcoming |

---

## Getting Started

### Prerequisites

- Node.js 20+
- Accounts (all free tier): [Clerk](https://clerk.com), [Supabase](https://supabase.com), [Cloudflare R2](https://developers.cloudflare.com/r2), [Google AI Studio](https://aistudio.google.com)

### Setup

```bash
git clone https://github.com/mahanyasbaira/OARS.git
cd OARS
npm install
cp .env.local.example .env.local
# Fill in your API keys — see .env.local.example for instructions
```

### Database

Run the migrations in order in your Supabase SQL Editor:

```
db/migrations/001_initial_schema.sql
db/migrations/002_extractions.sql
db/migrations/003_timeline.sql
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
OARS/
├── src/
│   ├── agents/          # AI agents (text, audio, vision, aggregator)
│   ├── app/             # Next.js App Router pages and API routes
│   ├── components/      # UI components
│   ├── schemas/         # Zod schemas shared across agents
│   ├── server/db/       # Database helpers (Supabase)
│   └── workers/         # Pipeline orchestration
├── db/migrations/       # SQL migration files
└── docs/                # Architecture, changelog, roadmap
```

---

## How It's Different

Most AI tools summarise one document at a time. OARS works across an entire corpus:

- **Multi-source by design** — every extraction is tagged to its source, so citations are automatic
- **Contradiction-aware** — the aggregator actively looks for conflicts between sources, not just consensus
- **Chronology-first** — the primary output is a timeline, because most research questions are fundamentally about what happened when
- **Modality-agnostic** — the same pipeline handles text, audio, and video through specialised perception agents that all emit the same schema

---

## License

MIT
