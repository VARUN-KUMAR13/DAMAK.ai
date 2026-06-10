from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class LiveMeetingCreate(BaseModel):
    title: str = Field(..., description="Title of the live session.")
    platform: Optional[str] = Field(None, description="Platform e.g. Meet, Zoom")


class LiveMeetingResponse(BaseModel):
    session_id: str
    title: str
    platform: Optional[str]
    status: str
    created_at: datetime


class TranscriptChunkPayload(BaseModel):
    speaker: Optional[str] = None
    text: str
    start_time: float
    is_final: bool = True


class TranscriptChunkResponse(TranscriptChunkPayload):
    id: str
    session_id: str
    created_at: datetime
