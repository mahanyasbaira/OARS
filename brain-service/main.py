"""
brain-service/main.py — FastAPI microservice for TRIBE v2 neural analysis.

Endpoints:
  POST /analyze          — submit a file URL for brain encoding prediction
  GET  /status/{job_id}  — poll job status
  GET  /health           — liveness check

Run:
  uvicorn main:app --host 0.0.0.0 --port 8000 --reload

Environment:
  TRIBE_MOCK=1   (default) — use mock inference; set to 0 for real GPU inference
  BRAIN_SERVICE_SECRET — shared secret validated against X-Brain-Secret header
"""

from __future__ import annotations

import asyncio
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Header, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from tribe_runner import run_prediction, MOCK_MODE

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(
    title="OARS Brain Service",
    description="TRIBE v2 neural encoding microservice",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://*.vercel.app"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

_SECRET = os.getenv("BRAIN_SERVICE_SECRET", "dev-secret")

# ---------------------------------------------------------------------------
# In-memory job store  (swap for Redis/Supabase in production)
# ---------------------------------------------------------------------------

JobStatus = Literal["pending", "running", "complete", "failed"]

class Job(BaseModel):
    job_id: str
    project_id: str
    extraction_id: str
    status: JobStatus = "pending"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completed_at: str | None = None
    error: str | None = None
    result: dict[str, Any] | None = None

_jobs: dict[str, Job] = {}

# ---------------------------------------------------------------------------
# Auth dependency
# ---------------------------------------------------------------------------

def verify_secret(x_brain_secret: str | None = Header(default=None)) -> None:
    if x_brain_secret != _SECRET:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid secret")

# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------

class AnalyzeRequest(BaseModel):
    file_url: str = Field(..., description="Signed R2 URL to the source file")
    file_type: str = Field(..., description="video | audio | pdf | text")
    project_id: str
    extraction_id: str
    duration_hint: float = Field(30.0, description="Estimated content duration in seconds")

class AnalyzeResponse(BaseModel):
    job_id: str
    status: JobStatus

class StatusResponse(BaseModel):
    job_id: str
    project_id: str
    extraction_id: str
    status: JobStatus
    created_at: str
    completed_at: str | None
    error: str | None
    result: dict[str, Any] | None

# ---------------------------------------------------------------------------
# Background worker
# ---------------------------------------------------------------------------

async def _run_job(job_id: str, req: AnalyzeRequest) -> None:
    job = _jobs[job_id]
    job.status = "running"
    try:
        result = await run_prediction(
            file_url=req.file_url,
            file_type=req.file_type,
            duration_hint=req.duration_hint,
        )
        job.result = result
        job.status = "complete"
    except Exception as exc:  # noqa: BLE001
        job.status = "failed"
        job.error = str(exc)
    finally:
        job.completed_at = datetime.now(timezone.utc).isoformat()

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "mock_mode": MOCK_MODE,
        "active_jobs": sum(1 for j in _jobs.values() if j.status == "running"),
    }


@app.post(
    "/analyze",
    response_model=AnalyzeResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(verify_secret)],
)
async def analyze(
    req: AnalyzeRequest,
    background_tasks: BackgroundTasks,
) -> AnalyzeResponse:
    job_id = str(uuid.uuid4())
    job = Job(
        job_id=job_id,
        project_id=req.project_id,
        extraction_id=req.extraction_id,
    )
    _jobs[job_id] = job
    background_tasks.add_task(_run_job, job_id, req)
    return AnalyzeResponse(job_id=job_id, status="pending")


@app.get(
    "/status/{job_id}",
    response_model=StatusResponse,
    dependencies=[Depends(verify_secret)],
)
def get_status(job_id: str) -> StatusResponse:
    job = _jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return StatusResponse(**job.model_dump())
