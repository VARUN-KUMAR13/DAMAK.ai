"""Semantic search schemas."""

from __future__ import annotations

from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    """Semantic search query request."""
    query: str = Field(..., description="The semantic search query (e.g., 'What is normalization?')")
    job_id: Optional[UUID] = Field(None, description="Optional: filter by specific job_id")
    limit: int = Field(default=5, description="Maximum number of chunks to return")


class SearchResultChunk(BaseModel):
    """A single matched chunk in search results."""
    chunk_id: str
    job_id: UUID
    score: float = Field(..., description="Similarity score (closer to 1.0 is more similar)")
    start_time: float
    end_time: float
    text: str = Field(..., description="The text that was matched")
    slide_text: Optional[str] = None
    spoken_text: str
    screenshots: List[str] = Field(default_factory=list)


class SearchResponse(BaseModel):
    """Complete semantic search response."""
    query: str
    results: List[SearchResultChunk]
    total_matches: int
