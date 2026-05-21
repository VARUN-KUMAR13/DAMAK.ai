"""Transcript structure (API + on-disk JSON)."""

from __future__ import annotations

from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class TranscriptSegment(BaseModel):
    start: float = Field(..., description="Segment start time in seconds.")
    end: float = Field(..., description="Segment end time in seconds.")
    text: str


class TranscriptMetadata(BaseModel):
    job_id: UUID
    source_filename: str
    model: str
    language: Optional[str] = Field(
        default=None, description="Detected or specified language code."
    )


class TranscriptPayload(BaseModel):
    metadata: TranscriptMetadata
    segments: list[TranscriptSegment]
