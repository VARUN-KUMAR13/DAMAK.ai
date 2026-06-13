"""RAG chat schemas."""

from __future__ import annotations

from typing import List, Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    """RAG chat request."""
    question: str = Field(..., description="The user's question about the lecture.")
    job_id: Optional[UUID] = Field(None, description="Optional: filter by specific job_id.")
    top_k: int = Field(default=3, description="Number of relevant chunks to retrieve.")
    mode: str = Field(default="Standard", description="The tutor mode to use.")


class RetrievedSource(BaseModel):
    """Source chunk metadata for chat response."""
    chunk_id: str
    score: float
    spoken_text: str
    slide_text: Optional[str] = None
    screenshots: List[str] = Field(default_factory=list)
    start_time: float
    end_time: float


class ChatResponse(BaseModel):
    """RAG chat response."""
    answer: str = Field(..., description="The AI-generated answer based on the lecture context.")
    sources: List[RetrievedSource] = Field(default_factory=list, description="The sources used to generate the answer.")
