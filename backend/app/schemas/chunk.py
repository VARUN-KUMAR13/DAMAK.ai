"""Multimodal chunk schemas."""

from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


class MultimodalChunk(BaseModel):
    """A semantically aligned chunk of OCR and spoken text."""
    chunk_id: str = Field(..., description="Unique ID for the chunk (e.g., chunk_001)")
    start_time: float = Field(..., description="Start timestamp in seconds")
    end_time: float = Field(..., description="End timestamp in seconds")
    slide_text: Optional[str] = Field(None, description="Extracted OCR text from slides")
    spoken_text: str = Field(..., description="Transcribed speech for this time range")
    combined_text: str = Field(..., description="Contextually merged OCR and spoken text")
    screenshots: List[str] = Field(default_factory=list, description="List of screenshot filenames associated with this chunk")
    keywords: Optional[List[str]] = Field(None, description="List of keywords for this chunk")


class ChunkPayload(BaseModel):
    """Payload for saved chunks.json."""
    job_id: str
    chunks: List[MultimodalChunk]
    total_chunks: int
