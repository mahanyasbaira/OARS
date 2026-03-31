# OARS — Changelog

All notable changes to OARS are recorded here.
Format: `[date] — description`

---

## [2026-03-31] — Milestone 5: Production Hardening

### Added
- `src/lib/retry.ts` — `withRetry` utility: exponential backoff (2s, 4s, 8s), max 3 attempts
- `src/lib/email.ts` — Resend email notifications: extraction complete + report ready
- `src/app/api/projects/[id]/report/export/route.ts` — `GET /api/projects/[id]/report/export` downloads report as Markdown
- Export Markdown button on Report page
- `hasExtractionForSource` deduplication guard — skips re-processing already-extracted sources
- `getProjectNameById` — server-side project name lookup for use in workers
- `getProjectOwnerEmail` — fetches project owner email for notifications
- `playwright.config.ts` — Playwright E2E config (Chromium, baseURL localhost:3000)
- `tests/landing.spec.ts` — landing page heading and CTA link tests
- `tests/auth-guard.spec.ts` — unauthenticated browser redirects to `/sign-in`
- `tests/api-auth.spec.ts` — unauthenticated API requests return 401

### Changed
- All three workers (`extract-text`, `extract-multimodal`, `aggregate-timeline`) now use `withRetry` for agent calls
- Workers send email on completion (fire-and-forget, skipped if `RESEND_API_KEY` not set)
- `package.json` — added `test:e2e` script and `@playwright/test` dev dependency

---

## [2026-03-29] — Milestone 4: Multimodal Expansion + Report Generation

### Added
- `src/agents/audio-agent.ts` — Audio Agent (Gemini 2.5 Flash) processes audio files
- `src/agents/vision-agent.ts` — Vision Agent (Gemini 2.5 Flash) processes images and video frames
- `src/agents/report-agent.ts` — Report Agent synthesises all extractions + timeline into a research brief
- `src/schemas/report.ts` — `ReportPayloadSchema` (executive summary, key findings, contradiction matrix)
- `src/workers/extract-multimodal.ts` — cross-modal: video files run Audio + Vision agents in parallel
- `src/workers/generate-report.ts` — user-triggered report generation
- `src/server/db/reports.ts` — save/fetch report helpers
- `db/migrations/004_reports.sql` — `reports` table with RLS
- `POST /api/projects/[id]/report` — trigger report generation
- `GET /api/projects/[id]/report` — fetch latest report
- Report tab + report viewer UI (executive summary, key findings, contradiction matrix)
- Sources / Timeline / Report tab nav on project page

### Changed
- Upload confirm route auto-triggers multimodal pipeline for audio/video/image files

---

## [2026-03-29] — Milestone 3: Timeline Aggregation

### Added
- `db/migrations/003_timeline.sql` — `timeline_events` and `contradictions` tables with RLS
- `src/schemas/timeline.ts` — `TimelineEventSchema`, `ContradictionSchema`, `AggregatorPayloadSchema`
- `src/agents/aggregator-agent.ts` — Temporal Aggregator merges events across sources, detects contradictions
- `src/workers/aggregate-timeline.ts` — runs after every successful extraction
- `src/server/db/timeline.ts` — `saveTimeline` (replace-all), `getTimeline` helpers
- `GET /api/projects/[id]/timeline` — returns merged events + contradictions
- `/dashboard/projects/[id]/timeline` — timeline UI with conflict indicators and source quotes
- Sources / Timeline tab nav on project page

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
