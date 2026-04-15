"""
tribe_runner.py — TRIBE v2 inference wrapper.

Attempts to import the real tribev2 package. Falls back to MOCK_MODE when the
package is not installed so UI development can proceed without GPU/model setup.

To enable real inference:
  1. git clone https://github.com/facebookresearch/tribev2
  2. cd tribev2 && pip install -e ".[plotting]"
  3. Set TRIBE_MOCK=0 (or remove the env var)
"""

from __future__ import annotations

import os
import math
import random
import tempfile
import time
from pathlib import Path
from typing import Any

import httpx
import numpy as np

# ---------------------------------------------------------------------------
# Model path
# ---------------------------------------------------------------------------
_HF_SNAPSHOT = Path.home() / ".cache/huggingface/hub/models--facebook--tribev2/snapshots/f894e783020944dcd96e5568550afe2aa9743f9f"

# ---------------------------------------------------------------------------
# Try real model import; fall back to mock
# ---------------------------------------------------------------------------
MOCK_MODE: bool = os.getenv("TRIBE_MOCK", "1") != "0"

if not MOCK_MODE:
    try:
        from tribev2 import TribeModel  # type: ignore
    except ImportError:
        print("[tribe_runner] tribev2 not installed — falling back to MOCK_MODE")
        MOCK_MODE = True

# ---------------------------------------------------------------------------
# Constants matching fsaverage5 mesh
# ---------------------------------------------------------------------------
N_CORTICAL = 20_484
N_SUBCORTICAL = 8_802

ROI_VERTICES: dict[str, tuple[int, int]] = {
    # Cortical ROIs (vertex index ranges on fsaverage5, approximate)
    "visual_early":     (0,    1500),
    "visual_ventral":   (1500, 3000),
    "visual_dorsal":    (3000, 4500),
    "visual_mt":        (4500, 5000),
    "multisensory_tpj": (5000, 6500),
    "auditory_early":   (6500, 7500),
    "auditory_assoc":   (7500, 8500),
    "inferior_frontal": (8500, 9500),
    "vwfa":             (9500, 10000),
}

SUBCORTICAL_ROIS: dict[str, tuple[int, int]] = {
    "hippocampus":       (0,    1000),
    "amygdala":          (1000, 1800),
    "thalamus":          (1800, 3000),
    "caudate":           (3000, 4200),
    "putamen":           (4200, 5500),
    "pallidum":          (5500, 6500),
    "nucleus_accumbens": (6500, 7500),
    "lateral_ventricle": (7500, 8802),
}

EMOTION_MAP: list[dict[str, Any]] = [
    {"roi": "amygdala",          "emotion": "Fear / Emotional Arousal",  "threshold": 0.4},
    {"roi": "nucleus_accumbens", "emotion": "Reward / Pleasure",          "threshold": 0.35},
    {"roi": "multisensory_tpj",  "emotion": "Empathy / Social Cognition", "threshold": 0.3},
    {"roi": "hippocampus",       "emotion": "Memory Formation",           "threshold": 0.45},
    {"roi": "inferior_frontal",  "emotion": "Language Engagement",        "threshold": 0.3},
    {"roi": "visual_ventral",    "emotion": "Face / Scene Recognition",   "threshold": 0.35},
    {"roi": "auditory_early",    "emotion": "Auditory Attention",         "threshold": 0.3},
    {"roi": "caudate",           "emotion": "Motivated Engagement",       "threshold": 0.35},
    {"roi": "visual_mt",         "emotion": "Motion Alertness",           "threshold": 0.3},
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mean_activation(arr: np.ndarray, start: int, end: int) -> float:
    return float(np.mean(np.abs(arr[start:end])))


def _infer_emotions(
    cortical: np.ndarray,
    subcortical: np.ndarray,
) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for mapping in EMOTION_MAP:
        roi = mapping["roi"]
        if roi in ROI_VERTICES:
            s, e = ROI_VERTICES[roi]
            strength = _mean_activation(cortical, s, e)
        else:
            s, e = SUBCORTICAL_ROIS[roi]
            strength = _mean_activation(subcortical, s, e)
        if strength >= mapping["threshold"]:
            confidence = min(1.0, strength / 0.8)
            results.append({
                "emotion": mapping["emotion"],
                "confidence": round(confidence, 3),
                "roi": roi,
                "strength": round(strength, 4),
            })
    results.sort(key=lambda x: x["confidence"], reverse=True)
    return results


def _build_roi_timeseries(
    cortical_frames: list[np.ndarray],
    subcortical_frames: list[np.ndarray],
) -> dict[str, list[float]]:
    ts: dict[str, list[float]] = {}
    for roi, (s, e) in ROI_VERTICES.items():
        ts[roi] = [float(np.mean(frame[s:e])) for frame in cortical_frames]
    for roi, (s, e) in SUBCORTICAL_ROIS.items():
        ts[roi] = [float(np.mean(frame[s:e])) for frame in subcortical_frames]
    return ts


# ---------------------------------------------------------------------------
# Mock inference
# ---------------------------------------------------------------------------

def _mock_predict(
    file_url: str,
    file_type: str,
    duration_hint: float = 30.0,
) -> dict[str, Any]:
    """Generate plausible-looking TRIBE v2 output without a GPU."""
    rng = np.random.default_rng(seed=abs(hash(file_url)) % (2**31))
    n_timesteps = max(2, int(duration_hint / 2))  # 1 frame per 2s

    cortical_frames: list[np.ndarray] = []
    subcortical_frames: list[np.ndarray] = []

    for t in range(n_timesteps):
        phase = t / max(n_timesteps - 1, 1)
        # Simulate dynamic activation patterns
        cortical = rng.normal(0, 0.15, N_CORTICAL).astype(np.float32)
        # Boost visual regions for video/image, auditory for audio, language for text
        if file_type in ("video", "image"):
            s, e = ROI_VERTICES["visual_early"]
            cortical[s:e] += 0.5 * math.sin(phase * math.pi)
            s, e = ROI_VERTICES["visual_ventral"]
            cortical[s:e] += 0.4 * phase
        if file_type in ("audio",):
            s, e = ROI_VERTICES["auditory_early"]
            cortical[s:e] += 0.6 * (1 - phase)
            s, e = ROI_VERTICES["auditory_assoc"]
            cortical[s:e] += 0.4
        if file_type in ("text", "pdf"):
            s, e = ROI_VERTICES["inferior_frontal"]
            cortical[s:e] += 0.5
            s, e = ROI_VERTICES["vwfa"]
            cortical[s:e] += 0.45 * phase

        subcortical = rng.normal(0, 0.1, N_SUBCORTICAL).astype(np.float32)
        # Amygdala activates in first half (arousal), accumbens in second (reward)
        sa, ea = SUBCORTICAL_ROIS["amygdala"]
        subcortical[sa:ea] += 0.5 * (1 - phase)
        sn, en = SUBCORTICAL_ROIS["nucleus_accumbens"]
        subcortical[sn:en] += 0.4 * phase

        cortical_frames.append(cortical)
        subcortical_frames.append(subcortical)

    last_cortical = cortical_frames[-1]
    last_subcortical = subcortical_frames[-1]

    # Trimodal contributions (R=text, G=audio, B=video)
    trimodal: list[dict[str, float]] = []
    for frame in cortical_frames:
        trimodal.append({
            "r": round(float(rng.uniform(0.1, 0.6)), 3),
            "g": round(float(rng.uniform(0.1, 0.6)), 3),
            "b": round(float(rng.uniform(0.1, 0.6)), 3),
        })

    return {
        "mock": True,
        "n_timesteps": n_timesteps,
        "timestep_seconds": 2,
        "cortical_activations": last_cortical.tolist(),
        "subcortical_activations": last_subcortical.tolist(),
        "cortical_frames": [f.tolist() for f in cortical_frames],
        "subcortical_frames": [f.tolist() for f in subcortical_frames],
        "roi_timeseries": _build_roi_timeseries(cortical_frames, subcortical_frames),
        "trimodal_contributions": trimodal,
        "emotions": _infer_emotions(last_cortical, last_subcortical),
        "segments": [
            {"start": t * 2, "end": (t + 1) * 2, "label": f"Segment {t + 1}"}
            for t in range(n_timesteps)
        ],
        "encoding_scores": {
            roi: round(float(rng.uniform(0.05, 0.55)), 3)
            for roi in list(ROI_VERTICES) + list(SUBCORTICAL_ROIS)
        },
    }


# ---------------------------------------------------------------------------
# Real inference
# ---------------------------------------------------------------------------

def _real_predict(file_path: str, file_type: str) -> dict[str, Any]:
    model = TribeModel.from_pretrained(  # type: ignore[name-defined]
        "facebook/tribev2",
        cache_folder=str(_HF_SNAPSHOT.parent.parent.parent),
    )
    kwargs: dict[str, str] = {}
    if file_type == "video":
        kwargs["video_path"] = file_path
    elif file_type == "audio":
        kwargs["audio_path"] = file_path
    else:
        kwargs["text_path"] = file_path

    df = model.get_events_dataframe(**kwargs)
    preds, segments = model.predict(events=df)  # preds: (T, 20484)

    cortical_frames = [preds[t].numpy() for t in range(preds.shape[0])]
    # TRIBE v2 does not output subcortical directly in base API; use zeros as placeholder
    subcortical_frames = [np.zeros(N_SUBCORTICAL, dtype=np.float32)] * len(cortical_frames)

    last_cortical = cortical_frames[-1]
    last_subcortical = subcortical_frames[-1]

    return {
        "mock": False,
        "n_timesteps": len(cortical_frames),
        "timestep_seconds": 2,
        "cortical_activations": last_cortical.tolist(),
        "subcortical_activations": last_subcortical.tolist(),
        "cortical_frames": [f.tolist() for f in cortical_frames],
        "subcortical_frames": [f.tolist() for f in subcortical_frames],
        "roi_timeseries": _build_roi_timeseries(cortical_frames, subcortical_frames),
        "trimodal_contributions": [],
        "emotions": _infer_emotions(last_cortical, last_subcortical),
        "segments": [
            {"start": seg["start"], "end": seg["end"], "label": seg.get("label", "")}
            for seg in segments
        ],
        "encoding_scores": {},
    }


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def run_prediction(
    file_url: str,
    file_type: str,
    duration_hint: float = 30.0,
) -> dict[str, Any]:
    """
    Download file_url to a temp file and run TRIBE v2 (or mock) inference.
    Returns a dict ready to be stored as JSONB in neuro_analyses.results.
    """
    if MOCK_MODE:
        # Simulate processing time proportional to content length
        await _async_sleep(min(3.0, duration_hint * 0.05))
        return _mock_predict(file_url, file_type, duration_hint)

    # Real: download then infer
    with tempfile.NamedTemporaryFile(suffix=_suffix(file_type), delete=False) as tmp:
        tmp_path = tmp.name
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.get(file_url)
            resp.raise_for_status()
            tmp.write(resp.content)

    try:
        return _real_predict(tmp_path, file_type)
    finally:
        Path(tmp_path).unlink(missing_ok=True)


def _suffix(file_type: str) -> str:
    return {
        "video": ".mp4",
        "audio": ".mp3",
        "pdf":   ".pdf",
        "text":  ".txt",
    }.get(file_type, ".bin")


async def _async_sleep(seconds: float) -> None:
    import asyncio
    await asyncio.sleep(seconds)
