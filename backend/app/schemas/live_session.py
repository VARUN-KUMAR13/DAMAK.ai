"""Live session schemas."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class SessionStatus(str, Enum):
    ACTIVE = "active"
    STOPPED = "stopped"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class LiveSessionCreate(BaseModel):
    title: str = Field(..., description="Title of the live session.")


class LiveSessionResponse(BaseModel):
    session_id: UUID
    title: str
    created_at: datetime
    status: SessionStatus
    screenshot_count: int = 0
    audio_chunks_count: int = 0
    message: Optional[str] = None


class LiveSessionDetail(LiveSessionResponse):
    processing_state: Optional[str] = None
    error_message: Optional[str] = None
