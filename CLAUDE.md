@AGENTS.md

---

# OARS — Project Context for Claude

## Project Identity

**OARS** (Omnimodal Autonomous Research System) is a Next.js 16 app that ingests documents, audio, and video, runs them through a 3-layer AI pipeline, and produces a unified research report with timeline, contradiction matrix, and citations.

- **Working directory**: `/Volumes/Me Things/Claude_code/OARS`
- **GitHub**: https://github.com/mahanyasbaira/OARS
- **Stack**: Next.js 16, TypeScript, Tailwind CSS 4, Shadcn/ui, Clerk (auth), Supabase (Postgres + RLS), Cloudflare R2, Gemini 2.5 Flash, Resend, Playwright, Zod 4
- **Milestones 1–5**: COMPLETE and merged to main

---

## Milestones 1–5 — What Is Already Built

| # | Milestone | Status |
|---|-----------|--------|
| 1 | Auth (Clerk) + Projects + File Upload (Cloudflare R2) | ✅ |
| 2 | Text extraction pipeline (Gemini 2.5 Flash, Zod, job queue) | ✅ |
| 3 | Timeline aggregation + contradiction detection | ✅ |
| 4 | Audio + Vision agents, Report generation, Report viewer UI | ✅ |
| 5 | Retry/backoff (withRetry), Resend email, Markdown export, Playwright E2E tests, deduplication guard | ✅ |

Key files from M1–M5:
- `src/lib/retry.ts` — `withRetry<T>(fn, options)` exponential backoff (2s→4s→8s, max 3 attempts)
- `src/lib/email.ts` — `sendExtractionCompleteEmail`, `sendReportReadyEmail` via Resend
- `src/app/api/projects/[id]/report/export/route.ts` — Markdown export endpoint
- `src/workers/` — `extract-text.ts`, `extract-multimodal.ts`, `aggregate-timeline.ts`, `generate-report.ts`
- `src/agents/` — `text-agent.ts`, `audio-agent.ts`, `vision-agent.ts`, `aggregator-agent.ts`, `report-agent.ts`
- `tests/` — Playwright E2E: `landing.spec.ts`, `auth-guard.spec.ts`, `api-auth.spec.ts`

---

## Milestone 6 — TRIBE v2 Neural Analysis

### What TRIBE v2 Actually Is

**TRIBE v2 is a brain encoding model**, not an emotion classifier. It takes naturalistic stimuli (video, audio, text) and predicts the fMRI BOLD signal that a human brain would produce in response — across ~20,484 cortical vertices (fsaverage5 mesh) + ~8,802 subcortical voxels.

The model was published by FAIR at Meta on March 25, 2026. Paper at:
`/Volumes/Me Things/Claude_code/OARS/Meta's TRIBE v2/657045057_A_Foundation_Model_of_Vision_Audition_and_Language_for_In_Silico_Neuroscience.pdf`

The model is already installed locally:
`~/.cache/huggingface/hub/models--facebook--tribev2/snapshots/f894e783020944dcd96e5568550afe2aa9743f9f/`
- `best.ckpt` — model weights (709 MB)
- `config.yaml` — architecture config

### TRIBE v2 Architecture

- **Text encoder**: `meta-llama/Llama-3.2-3B` — 2 Hz sampling, word-level timings
- **Audio encoder**: `facebook/w2v-bert-2.0` — 2 Hz, 60s chunks
- **Video encoder**: `facebook/vjepa2-vitg-fpc64-256` — 2 Hz, 64 frames / 4s windows
- **Fusion**: 8-layer Transformer, 8 attention heads, hidden_size=1152 (3×384)
- **Output**: fsaverage5 cortical mesh (20,484 vertices) + Harvard-Oxford subcortical atlas

### Python Inference API

```python
from tribev2 import TribeModel

model = TribeModel.from_pretrained("facebook/tribev2", cache_folder="./cache")

# Pass video, audio, or text (or all three)
df = model.get_events_dataframe(video_path="path/to/video.mp4")
preds, segments = model.predict(events=df)
# preds.shape == (n_timesteps, n_vertices)  — cortical surface
```

Install: `pip install -e .` from the snapshot folder, with `pip install -e ".[plotting]"` for brain visualization.

**CRITICAL**: TRIBE v2 is PyTorch/Python. It CANNOT run inside Next.js. It requires a **Python microservice** (FastAPI) that the Next.js app calls over HTTP.

### Brain Regions to Expose

**Cortical ROIs** (from paper Figure 2 and Figure 4):
- Visual Early (V1, V2, V3)
- Visual Ventral (V4, LOC, FFA — face-selective, PPA — place-selective, EBA — body-selective)
- Visual Dorsal (V3A, V7, IPS)
- Visual MT (motion-selective)
- Multisensory / TPJ (temporo-parietal junction — emotional language, social cognition)
- Auditory Early (A1, Belt)
- Auditory Association (STS — superior temporal sulcus)
- Inferior Frontal / Broca's (language production)
- VWFA (visual word form area — reading)

**Subcortical ROIs** (Harvard-Oxford atlas):
- Hippocampus (episodic memory)
- Amygdala (emotional arousal, threat detection)
- Thalamus (sensory relay)
- Caudate (reward/motivation)
- Putamen (procedural learning)
- Pallidum (motor control)
- Nucleus Accumbens (reward)
- Lateral Ventricle (reference — should be near zero)

### Emotion Interpretation Layer

TRIBE v2 does not output emotions directly. Emotions are a downstream interpretation based on which regions activate. Use this mapping:

| Activated Region | Emotion / Cognitive State |
|-----------------|--------------------------|
| Amygdala (bilateral) | Fear, emotional arousal, threat response |
| Amygdala + Hippocampus | Emotionally charged memory formation |
| TPJ / MTG | Empathy, emotional language, social cognition |
| Nucleus Accumbens | Reward, pleasure, anticipation |
| Inferior Frontal / Broca's | Emotional language processing |
| Visual Ventral (FFA) | Recognition of emotional faces |
| Auditory Early + Amygdala | Startle, auditory threat |
| Caudate + Putamen | Motivated engagement, habit |
| Visual MT (high) | Motion-driven alertness |

When multiple regions co-activate, combine interpretations (e.g., Amygdala + Accumbens = excited anticipation).

### Target Visualizations (Match TRIBE v2 Paper)

These are the exact visuals from the paper the user wants to replicate in the UI:

1. **Brain Surface Heatmap** (paper Figure 1C, Figure 10)
   - Gray cortical mesh (fsaverage5) with orange/red hot colormap
   - Each vertex colored by predicted BOLD amplitude
   - Rendered as a 2D flatmap or lateral/medial view
   - Updates per timestep (one frame every 2s of stimulus)

2. **Temporal Activation Frames** (paper Figure 10)
   - Grid of brain images at t=0s, 2s, 4s, 6s… showing how activation propagates
   - Color scale: 0 (gray) → high BOLD (bright orange/red)

3. **BOLD Timeseries per ROI** (paper Figure 9)
   - Line chart: x = time (seconds), y = mean BOLD across ROI vertices
   - One line per ROI, color-coded by region type
   - Shows which regions are active when

4. **RGB Trimodal Contribution Map** (paper Figure 7)
   - Red channel = text contribution, Green = audio, Blue = video
   - Rendered on brain surface — shows where each modality drives activation
   - Only meaningful when all 3 modalities are present

5. **Encoding Score Bar Chart** (paper Figure 2)
   - Bar chart: x = brain region, y = R² or Pearson r encoding score
   - Colored by modality (text/audio/video)
   - Shows which regions the model predicts well

6. **Functional Network Components** (paper Figure 6, ICA)
   - 5 ICA-derived networks: Visual, Auditory, Language, Default Mode, Sensorimotor
   - Each shown as a colored overlay on the brain surface

7. **Emotion Interpretation Panel**
   - Text overlay listing the inferred emotional states based on active regions
   - Confidence % per emotion (based on activation strength of corresponding ROI)
   - NOT from TRIBE v2 directly — computed from region activations using the mapping table above

### Integration Architecture

```
Next.js App (TypeScript)
    │
    ├── /api/projects/[id]/neuro/analyze  ──POST──► Python Microservice (FastAPI, port 8000)
    │                                                    │
    │                                              TribeModel.predict()
    │                                                    │
    │                                              Returns: {
    │                                                cortical_activations: float[],   // 20484 values
    │                                                subcortical_activations: float[], // 8802 values
    │                                                roi_timeseries: {roi: float[]},
    │                                                segments: [...],
    │                                                trimodal_contributions: {r,g,b}[]
    │                                              }
    │
    ├── /api/projects/[id]/neuro/status   ──GET───► Poll job status
    │
    └── /dashboard/projects/[id]/neuro    ──UI────► Brain visualization page
            ├── BrainSurface component (Three.js or Nilearn-style flatmap)
            ├── TemporalFrames component (grid of timestep images)
            ├── ROITimeseries component (Recharts line chart)
            ├── TrimodalMap component (RGB brain surface)
            └── EmotionPanel component (inferred emotions)
```

**Python microservice location**: `brain-service/` at project root
- `brain-service/main.py` — FastAPI app
- `brain-service/tribe_runner.py` — wraps TribeModel inference
- `brain-service/requirements.txt`
- `brain-service/README.md` — how to start

### Implementation Phases

**Phase 1 — Python microservice**
- Create `brain-service/` with FastAPI
- POST `/analyze` endpoint: accepts `{file_url, file_type, project_id, extraction_id}`
- Downloads the file from R2 (signed URL), runs TRIBE v2 inference
- Returns structured JSON (cortical activations, ROI timeseries, trimodal contributions)
- Background job with status polling (POST creates job, GET polls status)

**Phase 2 — Next.js API routes**
- `POST /api/projects/[id]/neuro/analyze` — trigger analysis, store job_id in Supabase
- `GET /api/projects/[id]/neuro/status` — poll job status
- `GET /api/projects/[id]/neuro/results` — fetch stored results
- New Supabase table: `neuro_analyses` (project_id, extraction_id, status, results JSONB)

**Phase 3 — Brain surface renderer**
- Use `@react-three-fiber` + `three` or a prebuilt WebGL brain viewer
- Load fsaverage5 mesh (provide as static asset in `public/brain/`)
- Color vertices by activation array using a hot colormap
- Camera controls: rotate, zoom, lateral/medial toggle

**Phase 4 — ROI timeseries + emotion panel**
- Recharts LineChart for BOLD timeseries
- Emotion inference function: takes `roi_activations`, returns `{emotion, confidence, regions}[]`
- Display as card list with confidence bars

**Phase 5 — Temporal frames + trimodal map**
- Render brain surface at each timestep, capture as image or animate
- RGB overlay for trimodal contributions

**Phase 6 — Wire into project UI**
- Add "Neural" tab to project page (alongside Sources, Timeline, Report)
- Show "Analyze" button per extraction
- Progressive loading: show available visualizations as they complete

**Phase 7 — DB migration**
- `db/migrations/005_neuro.sql`
- Table: `neuro_analyses` (id, project_id, extraction_id, user_id, status, job_id, results, created_at)
- RLS: `user_id = auth.uid()`

**Phase 8 — E2E tests**
- `tests/neuro.spec.ts` — auth guard on `/neuro` tab, API 401 guards

### Key Constraints

- TRIBE v2 requires **GPU** for fast inference; CPU works but is slow (~5–10 min for a 5-min video)
- The user's machine has the model at `~/.cache/huggingface/hub/models--facebook--tribev2/`
- Text input to TRIBE v2 is auto-converted to speech then transcribed for word-level timings
- Audio/text inputs yield activations primarily in language/auditory cortex; video adds visual cortex
- fsaverage5 mesh file needed for rendering: included in `nibabel`/`nilearn` Python packages

### Do Not

- Do not claim TRIBE v2 outputs emotions — it outputs BOLD predictions; emotions are our interpretation layer
- Do not run TRIBE v2 inside Node.js — always call the Python microservice
- Do not skip the Python microservice even for prototyping — the model is 700MB+ PyTorch

---

## Important Development Rules

- Read `node_modules/next/dist/docs/` before writing Next.js code — this version has breaking changes
- All API routes must be auth-protected via Clerk
- All Supabase queries must be scoped by `user_id` with RLS
- Use `withRetry` from `src/lib/retry.ts` for all external API calls
- Test scripts: `npm run dev`, `npm run build`, `npm run test:e2e`
- Free tier only — no paid API keys; mock where possible during development
