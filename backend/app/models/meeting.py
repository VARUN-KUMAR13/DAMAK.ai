import uuid
from datetime import datetime

from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


def generate_uuid():
    return str(uuid.uuid4())


class LiveMeeting(Base):
    __tablename__ = "live_meetings"

    session_id = Column(String, primary_key=True, default=generate_uuid, index=True)
    title = Column(String, nullable=False)
    platform = Column(String, nullable=True) # e.g. "Meet", "Zoom"
    status = Column(String, default="active") # "active", "completed", "failed"
    created_at = Column(DateTime, default=datetime.utcnow)
    
    chunks = relationship("TranscriptChunk", back_populates="meeting", cascade="all, delete-orphan")


class TranscriptChunk(Base):
    __tablename__ = "transcript_chunks"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    session_id = Column(String, ForeignKey("live_meetings.session_id"), index=True)
    speaker = Column(String, nullable=True)
    text = Column(String, nullable=False)
    start_time = Column(Float, nullable=False)
    is_final = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    meeting = relationship("LiveMeeting", back_populates="chunks")
