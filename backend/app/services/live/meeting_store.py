import json
import logging
from uuid import UUID, uuid4
from datetime import datetime
from typing import List, Dict, Optional
from pathlib import Path
from threading import Lock

from app.core.config import Settings
from app.schemas.meeting import LiveMeetingResponse, TranscriptChunkPayload, TranscriptChunkResponse

logger = logging.getLogger(__name__)

class MeetingStore:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.lock = Lock()
        self.meetings: Dict[str, dict] = {}
        
        self.meetings_dir = self.settings.storage_live / "meetings"
        self.meetings_dir.mkdir(parents=True, exist_ok=True)
        
        self._load_from_disk()

    def _load_from_disk(self):
        with self.lock:
            for meeting_file in self.meetings_dir.glob("*.json"):
                try:
                    data = json.loads(meeting_file.read_text(encoding="utf-8"))
                    self.meetings[data["session_id"]] = data
                except Exception as e:
                    logger.error(f"Failed to load meeting {meeting_file}: {e}")

    def _save_to_disk(self, session_id: str):
        if session_id in self.meetings:
            file_path = self.meetings_dir / f"{session_id}.json"
            file_path.write_text(json.dumps(self.meetings[session_id], indent=2), encoding="utf-8")

    def create_meeting(self, title: str, platform: str) -> LiveMeetingResponse:
        session_id = str(uuid4())
        created_at = datetime.utcnow()
        
        meeting = {
            "session_id": session_id,
            "title": title,
            "platform": platform,
            "status": "active",
            "created_at": created_at.isoformat(),
            "chunks": []
        }
        
        with self.lock:
            self.meetings[session_id] = meeting
            self._save_to_disk(session_id)
            
        return LiveMeetingResponse(
            session_id=session_id,
            title=title,
            platform=platform,
            status="active",
            created_at=created_at
        )

    def add_chunk(self, session_id: str, payload: TranscriptChunkPayload) -> Optional[TranscriptChunkResponse]:
        with self.lock:
            if session_id not in self.meetings:
                return None
                
            chunk_id = str(uuid4())
            created_at = datetime.utcnow()
            
            chunk = {
                "id": chunk_id,
                "session_id": session_id,
                "speaker": payload.speaker,
                "text": payload.text,
                "start_time": payload.start_time,
                "is_final": payload.is_final,
                "created_at": created_at.isoformat()
            }
            
            self.meetings[session_id]["chunks"].append(chunk)
            self._save_to_disk(session_id)
            
            return TranscriptChunkResponse(
                id=chunk_id,
                session_id=session_id,
                speaker=payload.speaker,
                text=payload.text,
                start_time=payload.start_time,
                is_final=payload.is_final,
                created_at=created_at
            )

    def get_meeting(self, session_id: str) -> Optional[dict]:
        with self.lock:
            return self.meetings.get(session_id)

    def update_status(self, session_id: str, status: str):
        with self.lock:
            if session_id in self.meetings:
                self.meetings[session_id]["status"] = status
                self._save_to_disk(session_id)
