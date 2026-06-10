"""Service for generating AI notes from lecture chunks."""

from __future__ import annotations

import logging
from typing import List, Optional
from uuid import UUID

from app.core.config import Settings
from app.schemas.intelligence import NotesMode, NotesResponse
from app.schemas.chunk import MultimodalChunk
from app.services.llm.ollama_service import OllamaService
from app.services.storage.job_store import JobStore

logger = logging.getLogger(__name__)


from app.services.live.meeting_store import MeetingStore

class NotesService:
    """Generates structured markdown notes from semantic chunks."""

    def __init__(self, settings: Settings, job_store: JobStore, ollama: OllamaService, meeting_store: Optional[MeetingStore] = None) -> None:
        self._settings = settings
        self._job_store = job_store
        self._ollama = ollama
        self._meeting_store = meeting_store

    async def generate_notes(self, session_id: UUID, mode: NotesMode) -> NotesResponse:
        """
        Generate notes for a session using semantic chunks.
        """
        logger.info("Generating %s notes for session %s", mode, session_id)
        
        # 1. Load chunks
        chunks_data = self._job_store.load_chunks(session_id)
        
        if not chunks_data and getattr(self, "_meeting_store", None):
            meeting = self._meeting_store.get_meeting(str(session_id))
            if meeting and "chunks" in meeting:
                chunks_data = [
                    {
                        "start_time": c.get("start_time", 0.0),
                        "spoken_text": c.get("text", ""),
                        "slide_text": None
                    } for c in meeting["chunks"]
                ]

        if not chunks_data:
            return NotesResponse(
                session_id=session_id,
                title="Empty Session",
                mode=mode,
                content="> ⚠️ **Cannot generate notes: No audio or text captured for this session.**\n\nMake sure your microphone/tab audio was recorded and that the processing pipeline has finished running.",
                key_concepts=[],
                citations=[]
            )

        # 2. Prepare context from chunks
        # Chunk sampling strategy to avoid overwhelming the LLM
        max_chunks = 30
        if len(chunks_data) > max_chunks:
            step = len(chunks_data) / max_chunks
            sampled_chunks = [chunks_data[int(i * step)] for i in range(max_chunks)]
        else:
            sampled_chunks = chunks_data

        context_parts = []
        for i, c in enumerate(sampled_chunks):
            start_time = c.get('start_time', 0.0)
            part = f"--- Chunk {i+1} [Time: {start_time:.1f}s] ---\n"
            if c.get('slide_text'):
                part += f"Slide: {c.get('slide_text')}\n"
            part += f"Speech: {c.get('spoken_text')}\n"
            context_parts.append(part)
        
        context_text = "\n".join(context_parts)

        # 3. Build prompt based on mode
        prompt = self._build_notes_prompt(context_text, mode)

        # 4. Generate via Ollama
        try:
            raw_response = await self._ollama.generate_response(prompt, json_format=True)
            
            import json
            # Sometimes LLMs wrap json in ```json ... ```
            text = raw_response
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()
                
            try:
                data = json.loads(text)
                content = data.get("content", "No notes generated.")
                key_concepts = data.get("key_concepts", [])
                citations = data.get("citations", [])
            except Exception as e:
                logger.error("Failed to parse notes LLM response: %s. Raw response: %s", e, raw_response, exc_info=True)
                # Fallback if LLM fails to return valid JSON
                content = "Notes generation succeeded but the AI response could not be formatted properly. Please try regenerating."
                if "```" not in raw_response and "{" not in raw_response:
                    content = raw_response  # It might have just returned plain text markdown
                key_concepts = []
                citations = []
            
        except Exception as e:
            logger.error("Failed to generate notes via Ollama: %s", e, exc_info=True)
            raise RuntimeError(f"Notes generation failed: {e}") from e

        # Get title from job store
        job_rec = self._job_store.get(session_id)
        title = job_rec.source_filename if job_rec else "Untitled Session"

        return NotesResponse(
            session_id=session_id,
            title=title,
            mode=mode,
            content=content,
            key_concepts=key_concepts,
            citations=citations
        )

    def _build_notes_prompt(self, context: str, mode: NotesMode) -> str:
        instructions = {
            NotesMode.EASY: "Create simple, high-level summary notes with clear bullet points. Explain complex terms simply.",
            NotesMode.STANDARD: "Create structured academic notes with sections, key concepts, and detailed explanations.",
            NotesMode.DEEP: "Create comprehensive, in-depth technical notes. Include all details, formulas, and deep logic mentioned.",
            NotesMode.AS_IS: "Transcribe the lecture into a clean, readable document preserving the original flow.",
            NotesMode.EXAM: "Focus on potential exam questions, key definitions, and critical takeaways. Use a 'cheat sheet' style."
        }

        prompt = (
            "You are an expert academic note-taker.\n"
            f"Mode: {mode.value.upper()}\n"
            f"Instruction: {instructions.get(mode, instructions[NotesMode.STANDARD])}\n\n"
            "You MUST return your response ONLY as a valid JSON object with the following properties:\n"
            "- \"content\": A string containing the full markdown notes.\n"
            "- \"key_concepts\": An array of up to 10 strings, each representing a core concept.\n"
            "- \"citations\": An array of objects. Each object must have \"timestamp\" (number in seconds), and \"text\" (string summarizing the source).\n\n"
            "Use Markdown formatting inside the 'content' string (headers, lists, bold text).\n"
            "Lecture Context:\n"
            f"{context}\n\n"
            "Respond ONLY with the raw JSON object. Do not include markdown blocks outside the JSON."
        )
        return prompt
