# OARS — Roadmap

---

## Milestone 1 — Foundation (current)
**Goal:** Working auth, project creation, file upload

- [ ] Node.js installed, Next.js scaffold created
- [ ] Git repo initialized and pushed to GitHub
- [ ] Clerk auth integrated (sign in / sign up)
- [ ] Supabase schema: `users`, `projects`, `sources`, `uploads`
- [ ] Row Level Security on all user-owned tables
- [ ] File upload to Cloudflare R2
- [ ] Source record created in Supabase on upload
- [ ] Basic dashboard UI (project list, upload UI)

---

## Milestone 2 — Text Extraction Pipeline
**Goal:** End-to-end extraction from PDF/text to structured output

- [ ] Text Agent (Claude or Gemini) processes uploaded PDFs
- [ ] Structured extraction schema (Zod-validated)
- [ ] Job queue and status tracking (`jobs` table)
- [ ] Background worker triggered on file upload
- [ ] Extraction results stored in `extractions` table
- [ ] UI shows job status (queued / running / done / failed)

---

## Milestone 3 — Timeline Aggregation
**Goal:** Multi-source chronology from text extractions

- [ ] `timeline_events` table with source attribution
- [ ] Temporal Aggregator agent merges events across sources
- [ ] Contradiction detection between sources
- [ ] Basic timeline UI (chronological list with source badges)

---

## Milestone 4 — Multimodal Expansion
**Goal:** Audio and vision agents, richer reporting

- [ ] Audio Agent (Gemini 1.5 Flash, free tier) for transcripts/audio
- [ ] Vision Agent (Gemini 1.5 Flash) for video frames / screenshots
- [ ] Contradiction matrix output
- [ ] Report generation: executive summary, timeline report, contradiction report
- [ ] Report viewer with citations/provenance

---

## Milestone 5 — Production Hardening
**Goal:** Ready for real use

- [x] Export workflows (PDF, Markdown download)
- [x] Email notifications via Resend
- [x] Retry + exponential backoff for all agent failures
- [x] Cost controls and deduplication guards
- [x] End-to-end Playwright tests for critical paths
- n/a Vector pruning cron job — no vector/embedding tables in current schema

---

## API Cost Strategy (Testing Phase)

| Service | Testing approach |
|---------|-----------------|
| Anthropic Claude | Mock responses in dev; Haiku for real calls |
| Gemini 1.5 Flash | Free tier (15 req/min) — use for all multimodal work |
| Supabase | Free tier (500MB) |
| Clerk | Free tier (10k MAU) |
| Cloudflare R2 | Free tier (10GB) |
| Resend | Free tier (3k/month) — skip until Milestone 5 |
