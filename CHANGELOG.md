# Changelog

## Unreleased — Milestone 6 Complete (Neural Analysis, Phases 1–8)

### Added

- `brain-service/` — FastAPI microservice wrapping TRIBE v2 (Meta FAIR brain encoding model)
  - `POST /analyze` — submit file URL for background inference; returns `job_id`
  - `GET /status/{job_id}` — poll job progress; result includes cortical activations, ROI timeseries, emotion inference, trimodal contributions
  - `GET /health` — liveness check
  - Mock mode (`TRIBE_MOCK=1`, default) generates realistic fMRI-shaped data so UI development proceeds without GPU/model install
  - `brain-service/.venv/` — isolated Python env with fastapi, uvicorn, httpx, numpy
- `db/migrations/005_neuro.sql` — `neuro_analyses` table with RLS (scoped by `user_id`)
- `src/server/db/neuro.ts` — CRUD helpers for `neuro_analyses`
- `src/app/api/projects/[id]/neuro/analyze/route.ts` — POST: trigger analysis, store job in Supabase
- `src/app/api/projects/[id]/neuro/status/route.ts` — GET: sync in-flight jobs from brain-service and return list
- `src/app/api/projects/[id]/neuro/results/route.ts` — GET: fetch stored results by `analysis_id`
- `src/app/dashboard/projects/[id]/neuro/page.tsx` — Neural tab page (server component)
- `src/components/neuro/neuro-panel.tsx` — client component: lists analyses, polls in-flight jobs, shows emotion panel and ROI peak activations
- Neural tab link added to project page navigation

#### Phase 2 — Next.js API routes (same entry above)

#### Phase 3–5 — Visualizations

- `public/brain/fsaverage5.json` — parametric icosphere brain mesh (5124 verts, 10240 faces, 296 KB)
- `brain-service/generate_mesh.py` — generates mesh from real nilearn data or parametric fallback
- `src/components/neuro/colormap.ts` — hot colormap, vertex color conversion, ROI color map
- `src/components/neuro/brain-surface.tsx` — Three.js WebGL renderer with vertex colors, frame animation, orbit controls
- `src/components/neuro/roi-timeseries.tsx` — Recharts line chart of BOLD timeseries per ROI
- `src/components/neuro/emotion-panel.tsx` — emotion interpretation cards with confidence bars
- `src/components/neuro/encoding-score-chart.tsx` — Recharts horizontal bar chart per brain region
- `src/components/neuro/temporal-frames.tsx` — clickable grid of activation thumbnails per timestep
- `src/components/neuro/trimodal-map.tsx` — RGB timeline strip + modality breakdown per timestep

#### Phase 6 — Wiring

- `src/components/sources/source-list.tsx` — Analyze button per ready source; calls neuro analyze API with extraction_id; shows queuing/submitted/error states
- `src/app/api/projects/[id]/neuro/analyze/route.ts` — generates signed R2 download URL server-side from source's r2_key
- `src/lib/r2/upload.ts` — added `getSignedDownloadUrl(key)` (presigned GET, 1h expiry)
- `src/components/neuro/neuro-panel.tsx` — full tabbed UI: Brain Surface · ROI Timeseries · Emotions · Temporal Frames · Trimodal Map · Encoding Scores; lazy-loads Three.js renderer; polls in-flight jobs; running/pending placeholder states

#### Phase 8 — E2E tests

- `tests/neuro.spec.ts` — auth guard on `/neuro` tab (unauthenticated redirect), 401 guards on all three neuro API routes

### Notes

- Real TRIBE v2 inference: clone `github.com/facebookresearch/tribev2`, run `pip install -e ".[plotting]"`, set `TRIBE_MOCK=0`
- Model weights at `~/.cache/huggingface/hub/models--facebook--tribev2/`
- Start brain service: `cd brain-service && source .venv/bin/activate && uvicorn main:app --reload`

## [Prior]

- Milestones 1–5 complete and merged to main (auth, extraction pipeline, timeline, multimodal agents, production hardening)
