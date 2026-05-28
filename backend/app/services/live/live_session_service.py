"""Service for managing live capture sessions."""

from __future__ import annotations

import json
import logging
import time
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any
from uuid import UUID, uuid4

import cv2
import numpy as np
from skimage.metrics import structural_similarity

from app.core.config import Settings
from app.schemas.live_session import SessionStatus, LiveSessionDetail
from app.services.storage.job_store import JobStore, JobRecord
from app.schemas.job import JobStatus

logger = logging.getLogger(__name__)


class LiveSessionService:
    """Manages live session lifecycle and real-time uploads."""

    def __init__(self, settings: Settings, job_store: JobStore) -> None:
        self._settings = settings
        self._job_store = job_store
        self._active_sessions: Dict[UUID, Dict[str, Any]] = {}

    def start_session(self, title: str) -> LiveSessionDetail:
        session_id = uuid4()
        created_at = datetime.now()
        
        # Create storage directories
        session_dir = self._settings.storage_live / str(session_id)
        session_dir.mkdir(parents=True, exist_ok=True)
        
        screenshot_dir = session_dir / "screenshots"
        screenshot_dir.mkdir(parents=True, exist_ok=True)
        
        audio_file = session_dir / "audio_stream.wav" # We'll append/merge here
        
        session_data = {
            "session_id": session_id,
            "title": title,
            "created_at": created_at,
            "status": SessionStatus.ACTIVE,
            "screenshot_count": 0,
            "audio_chunks_count": 0,
            "session_dir": session_dir,
            "screenshot_dir": screenshot_dir,
            "audio_file": audio_file,
            "last_screenshot_gray": None,
        }
        
        self._active_sessions[session_id] = session_data
        
        logger.info("Started live session %s: %s", session_id, title)
        
        return LiveSessionDetail(
            session_id=session_id,
            title=title,
            created_at=created_at,
            status=SessionStatus.ACTIVE
        )

    def get_session(self, session_id: UUID) -> Optional[LiveSessionDetail]:
        if session_id in self._active_sessions:
            s = self._active_sessions[session_id]
            return LiveSessionDetail(
                session_id=s["session_id"],
                title=s["title"],
                created_at=s["created_at"],
                status=s["status"],
                screenshot_count=s["screenshot_count"],
                audio_chunks_count=s["audio_chunks_count"]
            )
        
        # Check job store if it's already finished
        job_rec = self._job_store.get(session_id)
        if job_rec:
            # Map JobStatus to SessionStatus
            status_map = {
                JobStatus.PENDING: SessionStatus.PROCESSING,
                JobStatus.PROCESSING: SessionStatus.PROCESSING,
                JobStatus.COMPLETED: SessionStatus.COMPLETED,
                JobStatus.FAILED: SessionStatus.FAILED,
            }
            return LiveSessionDetail(
                session_id=job_rec.job_id,
                title=job_rec.source_filename,
                created_at=datetime.fromtimestamp(job_rec.job_id.time / 1e7) if hasattr(job_rec.job_id, 'time') else datetime.now(), # fallback
                status=status_map.get(job_rec.status, SessionStatus.FAILED),
                error_message=job_rec.error_message
            )
            
        return None

    def list_active_sessions(self) -> list[LiveSessionDetail]:
        """List currently active capture sessions."""
        return [
            LiveSessionDetail(
                session_id=s["session_id"],
                title=s["title"],
                created_at=s["created_at"],
                status=s["status"],
                screenshot_count=s["screenshot_count"],
                audio_chunks_count=s["audio_chunks_count"]
            )
            for s in self._active_sessions.values()
        ]

    async def add_screenshot(self, session_id: UUID, image_bytes: bytes, timestamp: float) -> bool:
        session = self._active_sessions.get(session_id)
        if not session or session["status"] != SessionStatus.ACTIVE:
            return False

        # Decode image
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return False

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        gray_small = cv2.resize(gray, (320, 180), interpolation=cv2.INTER_AREA)

        # Duplicate detection using SSIM
        should_save = True
        if session["last_screenshot_gray"] is not None:
            score = float(structural_similarity(session["last_screenshot_gray"], gray_small))
            if score > self._settings.screenshot_ssim_threshold:
                should_save = False
        
        if should_save:
            session["screenshot_count"] += 1
            idx = session["screenshot_count"]
            filename = f"frame_{idx:04d}.jpg"
            save_path = session["screenshot_dir"] / filename
            cv2.imwrite(str(save_path), img)
            
            # Save metadata for this screenshot
            meta_path = session["session_dir"] / "screenshots_metadata.jsonl"
            meta_entry = {
                "filename": filename,
                "timestamp": timestamp,
                "frame_index": idx
            }
            with open(meta_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(meta_entry) + "\n")
                
            session["last_screenshot_gray"] = gray_small
            return True
            
        return False

    async def add_audio_chunk(self, session_id: UUID, audio_bytes: bytes) -> bool:
        session = self._active_sessions.get(session_id)
        if not session or session["status"] != SessionStatus.ACTIVE:
            return False

        # Append to raw audio stream (assuming PCM or similar for now, 
        # or we just store chunks and merge later)
        # For simplicity, we'll store as chunks and merge in stop_session
        chunk_idx = session["audio_chunks_count"] + 1
        chunk_path = session["session_dir"] / f"chunk_{chunk_idx:04d}.raw"
        chunk_path.write_bytes(audio_bytes)
        
        session["audio_chunks_count"] = chunk_idx
        return True

    def stop_session(self, session_id: UUID) -> Optional[LiveSessionDetail]:
        session = self._active_sessions.get(session_id)
        if not session:
            return None

        session["status"] = SessionStatus.STOPPED
        
        # Finalize audio: merge chunks
        # This is a simplified merge. In production, we'd use FFmpeg to concat.
        merged_audio_path = session["session_dir"] / "merged_audio.wav"
        with open(merged_audio_path, "wb") as outfile:
            for i in range(1, session["audio_chunks_count"] + 1):
                chunk_path = session["session_dir"] / f"chunk_{i:04d}.raw"
                if chunk_path.exists():
                    outfile.write(chunk_path.read_bytes())
                    # chunk_path.unlink() # Cleanup chunks
        
        # Convert metadata JSONL to JSON array for existing pipeline
        meta_path = session["session_dir"] / "screenshots_metadata.jsonl"
        entries = []
        if meta_path.exists():
            with open(meta_path, "r", encoding="utf-8") as f:
                for line in f:
                    entries.append(json.loads(line))
        
        final_meta_path = session["session_dir"] / "metadata.json"
        final_meta_path.write_text(json.dumps(entries, indent=2))
        
        # Create a JobRecord in JobStore to trigger the pipeline
        # We use session_id as job_id
        record = self._job_store.create_live_job(
            job_id=session_id,
            title=session["title"],
            audio_path=merged_audio_path,
            screenshots_dir=session["screenshot_dir"],
            screenshots_metadata_path=final_meta_path
        )
        
        # Clean up active session
        # del self._active_sessions[session_id]
        
        return LiveSessionDetail(
            session_id=session_id,
            title=session["title"],
            created_at=session["created_at"],
            status=SessionStatus.PROCESSING,
            screenshot_count=session["screenshot_count"],
            audio_chunks_count=session["audio_chunks_count"]
        )
