# OARS — Changelog

All notable changes to OARS are recorded here.
Format: `[date] — description`

---

## [2026-03-28] — Milestone 2: Text Extraction Pipeline

### Added
- `db/migrations/002_extractions.sql` — `extractions` and `agent_runs` tables with RLS
- `src/schemas/extraction.ts` — shared `ExtractionPayloadSchema` (Zod) used by all agents
- `src/agents/text-agent.ts` — Text Agent using Gemini 1.5 Flash (free tier, prompt v1)
- `src/workers/extract-text.ts` — extraction pipeline: fetch from R2 → parse PDF → run agent → save → update status
- `src/server/db/extractions.ts` — DB helpers for saving and fetching extractions
- `src/server/db/jobs.ts` — job lifecycle helpers (create, update status, increment attempts)
- `POST /api/extract` — manual trigger endpoint for extraction
- `GET /api/projects/[id]/sources/[sourceId]` — status + extraction summary for polling
- Auto-trigger extraction on upload confirm for text MIME types
- Source status badge polls every 3s while pending/processing, shows confidence % when ready
- `next.config.ts` — `serverExternalPackages: ['pdf-parse']` for CJS compatibility

## [2026-03-28] — Milestone 1: Auth + Projects + File Upload

### Added
- Clerk auth: sign-in, sign-up, middleware protecting all `/dashboard` routes
- Supabase migration `001_initial_schema.sql`: `users`, `projects`, `sources`, `uploads`, `jobs` tables with full RLS
- File upload flow: presigned R2 URL → direct client upload → confirm record in Supabase
- API routes: `GET/POST /api/projects`, `GET /api/projects/[id]/sources`, `POST /api/upload/presign`, `POST /api/upload/confirm`
- Dashboard UI: project list, new project modal, project detail page with source list and status badges
- Modality auto-detection from MIME type (text / audio / vision)
- File validation: 500MB size limit, accepted MIME type allowlist
- Shadcn/ui component set: Button, Card, Input, Label, Badge, Separator, DropdownMenu, Avatar

### Architecture notes
- Service-role Supabase client used server-side only; every query scoped by explicit `user_id` filter
- Client-side Supabase client (anon key) reserved for future browser-side queries
- R2 presign → upload → confirm pattern prevents orphaned DB records if upload fails

## [2026-03-28] — Project initialization

- Next.js 16 scaffold with TypeScript, Tailwind CSS, App Router
- `.gitignore` protecting all secret files
- `.env.local.example` with free-tier setup guide for all services
- `docs/` folder: architecture, changelog, roadmap
- Directory scaffold: `agents/`, `schemas/`, `server/`, `db/migrations/`, `workers/`
