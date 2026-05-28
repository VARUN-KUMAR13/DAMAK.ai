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


class NotesService:
    """Generates structured markdown notes from semantic chunks."""

    def __init__(self, settings: Settings, job_store: JobStore, ollama: OllamaService) -> None:
        self._settings = settings
        self._job_store = job_store
        self._ollama = ollama

    async def generate_notes(self, session_id: UUID, mode: NotesMode) -> NotesResponse:
        """
        Generate notes for a session using semantic chunks.
        """
        logger.info("Generating %s notes for session %s", mode, session_id)
        
        # 1. Load chunks
        chunks_data = self._job_store.load_chunks(session_id)
        if not chunks_data:
            raise ValueError(f"No chunks found for session {session_id}. Has it been processed?")

        # 2. Prepare context from chunks
        # We'll limit context if it's too long, or summarize in stages.
        # For now, we'll take all text and build a structured prompt.
        context_parts = []
        for c in chunks_data:
            part = f"[{c.get('start_time')}s] "
            if c.get('slide_text'):
                part += f"Slide: {c.get('slide_text')}\n"
            part += f"Speech: {c.get('spoken_text')}\n"
            context_parts.append(part)
        
        context_text = "\n".join(context_parts)

        # 3. Build prompt based on mode
        prompt = self._build_notes_prompt(context_text, mode)

        # 4. Generate via Ollama
        try:
            content = await self._ollama.generate_response(prompt)
        except Exception as e:
            logger.error("Failed to generate notes via Ollama: %s", e)
            raise RuntimeError(f"Notes generation failed: {e}") from e

        # 5. Extract metadata (simplified for now)
        key_concepts = self._extract_key_concepts(content)
        
        # Get title from job store
        job_rec = self._job_store.get(session_id)
        title = job_rec.source_filename if job_rec else "Untitled Session"

        return NotesResponse(
            session_id=session_id,
            title=title,
            mode=mode,
            content=content,
            key_concepts=key_concepts,
            citations=[] # Future: Map citations back to chunks
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
            "Use Markdown formatting (headers, lists, bold text).\n"
            "Reference timestamps like [MM:SS] when possible based on the provided context.\n\n"
            "Lecture Context:\n"
            f"{context}\n\n"
            "Generated Notes:"
        )
        return prompt

    def _extract_key_concepts(self, content: str) -> List[str]:
        # Very simple extraction for now - could be improved with LLM
        lines = content.split('\n')
        concepts = []
        for line in lines:
            if line.startswith('### ') or '**' in line:
                concept = line.replace('### ', '').replace('**', '').strip()
                if len(concept) < 50:
                    concepts.append(concept)
        return concepts[:10]
