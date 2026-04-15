# OARS Brain Service

FastAPI microservice that wraps TRIBE v2 (Meta FAIR) to predict fMRI brain responses to naturalistic stimuli.

## Quick start (mock mode — no GPU required)

```bash
cd brain-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Mock mode is enabled by default (`TRIBE_MOCK=1`). It generates realistic-looking cortical activation data so UI development can proceed without the full model.

## Enable real TRIBE v2 inference

1. Clone the TRIBE v2 source:
   ```bash
   git clone https://github.com/facebookresearch/tribev2
   cd tribev2
   pip install -e ".[plotting]"
   ```

2. The model weights are already at:
   ```
   ~/.cache/huggingface/hub/models--facebook--tribev2/snapshots/f894e783020944dcd96e5568550afe2aa9743f9f/
   ```

3. Start with real inference:
   ```bash
   TRIBE_MOCK=0 uvicorn main:app --host 0.0.0.0 --port 8000
   ```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TRIBE_MOCK` | `1` | Set to `0` for real GPU inference |
| `BRAIN_SERVICE_SECRET` | `dev-secret` | Shared secret — must match `BRAIN_SERVICE_SECRET` in Next.js `.env.local` |

## API

### `POST /analyze`

Submit a file for neural analysis. Returns immediately with a `job_id`; inference runs in the background.

**Headers**: `X-Brain-Secret: <secret>`

**Body**:
```json
{
  "file_url": "https://your-r2-bucket.r2.dev/signed/file.mp4",
  "file_type": "video",
  "project_id": "uuid",
  "extraction_id": "uuid",
  "duration_hint": 120.0
}
```

**Response** (`202 Accepted`):
```json
{ "job_id": "uuid", "status": "pending" }
```

### `GET /status/{job_id}`

Poll job progress. Status transitions: `pending → running → complete | failed`.

When `status == "complete"`, the response includes `result`:
```json
{
  "cortical_activations": [20484 floats],
  "subcortical_activations": [8802 floats],
  "cortical_frames": [[20484 floats], ...],
  "roi_timeseries": { "amygdala": [float, ...], ... },
  "trimodal_contributions": [{"r": 0.3, "g": 0.4, "b": 0.2}, ...],
  "emotions": [{"emotion": "Fear / Emotional Arousal", "confidence": 0.82, ...}],
  "segments": [{"start": 0, "end": 2, "label": "Segment 1"}, ...],
  "encoding_scores": { "visual_early": 0.43, ... },
  "mock": true
}
```

### `GET /health`

Returns `{ "status": "ok", "mock_mode": true, "active_jobs": 0 }`.
