"""Job-related API models."""

from __future__ import annotations

from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.transcript import TranscriptPayload


class JobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class JobCreateResponse(BaseModel):
    job_id: UUID
    status: JobStatus = JobStatus.PENDING
    message: str = Field(default="Upload accepted; processing started.")


class JobDetailResponse(BaseModel):
    job_id: UUID
    status: JobStatus
    source_filename: Optional[str] = None
    error_message: Optional[str] = None
    transcript_path: Optional[str] = Field(
        default=None,
        description="Absolute path to transcript JSON on disk (Phase 1).",
    )
    transcript: Optional[TranscriptPayload] = Field(
        default=None,
        description="Full transcript when status is completed.",
    )
    ocr_results: Optional[list[dict]] = Field(
        default=None,
        description="OCR text from screenshots when status is completed.",
    )
