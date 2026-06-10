import asyncio
import json
import logging
from uuid import UUID
from fastapi import WebSocket
from typing import List, Dict

from app.schemas.meeting import LiveMeetingResponse, TranscriptChunkPayload, TranscriptChunkResponse
from app.services.embeddings.embedding_service import EmbeddingService
from app.services.intelligence.notes_service import NotesService
from app.services.storage.job_store import JobStore
from app.services.live.meeting_store import MeetingStore
from app.schemas.job import JobStatus
from app.schemas.chunk import MultimodalChunk
from app.schemas.intelligence import NotesMode

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = []
        self.active_connections[session_id].append(websocket)

    def disconnect(self, websocket: WebSocket, session_id: str):
        if session_id in self.active_connections:
            self.active_connections[session_id].remove(websocket)

    async def broadcast_chunk(self, session_id: str, chunk: TranscriptChunkResponse):
        if session_id in self.active_connections:
            for connection in self.active_connections[session_id]:
                await connection.send_text(chunk.model_dump_json())

manager = ConnectionManager()

class MeetingService:
    def __init__(self, meeting_store: MeetingStore, job_store: JobStore, embeddings: EmbeddingService, notes: NotesService):
        self.meeting_store = meeting_store
        self.job_store = job_store
        self.embeddings = embeddings
        self.notes = notes
        self.manager = manager

    def start_meeting(self, title: str, platform: str) -> LiveMeetingResponse:
        response = self.meeting_store.create_meeting(title, platform)
        
        # Also create a dummy job in job_store to allow compatibility with search/chat
        self.job_store.create_live_job(
            job_id=UUID(response.session_id),
            title=response.title,
            audio_path=self.job_store._settings.storage_audio / f"{response.session_id}.wav", # Dummy
            screenshots_dir=self.job_store._settings.storage_screenshots / str(response.session_id),
            screenshots_metadata_path=self.job_store._settings.storage_screenshots / str(response.session_id) / "metadata.json"
        )
        
        return response

    async def add_transcript_chunk(self, session_id: str, chunk: TranscriptChunkPayload) -> TranscriptChunkResponse:
        resp = self.meeting_store.add_chunk(session_id, chunk)
        if not resp:
            raise ValueError("Meeting not found")
            
        await self.manager.broadcast_chunk(session_id, resp)
        return resp

    async def end_meeting(self, session_id: str):
        meeting = self.meeting_store.get_meeting(session_id)
        if not meeting:
            raise ValueError("Meeting not found")
            
        self.meeting_store.update_status(session_id, "completed")
        
        # 1. Gather all chunks
        chunks = meeting.get("chunks", [])
        
        # 2. Synthesize MultimodalChunks for embeddings/notes
        multimodal_chunks = []
        raw_chunks_data = []
        
        current_text = []
        current_start = 0.0
        word_count = 0
        chunk_id_counter = 1
        
        for c in chunks:
            if not current_text:
                current_start = c["start_time"]
            
            current_text.append(c["text"])
            words = len(c["text"].split())
            word_count += words
            
            if word_count >= 50 or c == chunks[-1]:
                combined_text = " ".join(current_text)
                mm_chunk = MultimodalChunk(
                    chunk_id=str(chunk_id_counter),
                    start_time=current_start,
                    end_time=c["start_time"] + 5.0, # Approximate
                    spoken_text=combined_text,
                    slide_text=None,
                    screenshots=[],
                    combined_text=combined_text
                )
                multimodal_chunks.append(mm_chunk)
                raw_chunks_data.append({
                    "chunk_id": str(chunk_id_counter),
                    "start_time": current_start,
                    "end_time": c["start_time"] + 5.0,
                    "spoken_text": combined_text,
                    "slide_text": None,
                    "screenshots": []
                })
                
                chunk_id_counter += 1
                current_text = []
                word_count = 0

        # Save to JobStore for compatibility with search/chat/notes
        job_id = UUID(session_id)
        job_rec = self.job_store.get(job_id)
        if job_rec and job_rec.chunks_path:
            job_rec.chunks_path.parent.mkdir(parents=True, exist_ok=True)
            job_rec.chunks_path.write_text(json.dumps({"chunks": raw_chunks_data}), encoding="utf-8")
            self.job_store.update_status(job_id, JobStatus.PROCESSING)
            self.job_store.update_stage(job_id, "Indexing meeting chunks...")
            
            # Trigger embeddings
            try:
                self.embeddings.index_chunks(job_id, multimodal_chunks)
            except Exception as e:
                logger.error(f"Failed to index meeting chunks: {e}", exc_info=True)
                
            # Trigger Ollama notes extraction (in background usually, but here we can just fire it async)
            self.job_store.update_stage(job_id, "Generating AI Notes & Flashcards...")
            asyncio.create_task(self._generate_notes_async(job_id))
            
    async def _generate_notes_async(self, job_id: UUID):
        try:
            await self.notes.generate_notes(job_id, NotesMode.STANDARD)
            self.job_store.update_status(job_id, JobStatus.COMPLETED)
        except Exception as e:
            logger.error(f"Failed to generate notes for meeting {job_id}: {e}", exc_info=True)
            self.job_store.mark_failed(job_id, str(e))
