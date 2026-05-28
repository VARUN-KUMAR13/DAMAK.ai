"""Service for generating flashcards and quiz content."""

from __future__ import annotations

import json
import logging
import re
from typing import List, Optional
from uuid import UUID

from app.core.config import Settings
from app.schemas.intelligence import Flashcard, FlashcardType, FlashcardResponse
from app.services.llm.ollama_service import OllamaService
from app.services.storage.job_store import JobStore

logger = logging.getLogger(__name__)


class FlashcardService:
    """Generates study materials like flashcards and MCQs."""

    def __init__(self, settings: Settings, job_store: JobStore, ollama: OllamaService) -> None:
        self._settings = settings
        self._job_store = job_store
        self._ollama = ollama

    async def generate_flashcards(self, session_id: UUID, count: int, card_type: FlashcardType) -> FlashcardResponse:
        """
        Generate flashcards for a session.
        """
        logger.info("Generating %d %s flashcards for session %s", count, card_type, session_id)
        
        chunks_data = self._job_store.load_chunks(session_id)
        if not chunks_data:
            raise ValueError(f"No chunks found for session {session_id}.")

        # Take a sample of chunks to avoid overwhelming the LLM
        # In a real system, we'd pick the most 'informative' chunks
        context = "\n".join([f"Chunk: {c.get('combined_text')}" for c in chunks_data[:10]])

        prompt = self._build_flashcard_prompt(context, count, card_type)

        try:
            raw_response = await self._ollama.generate_response(prompt)
            flashcards = self._parse_flashcards(raw_response, card_type)
        except Exception as e:
            logger.error("Failed to generate flashcards: %s", e)
            raise RuntimeError(f"Flashcard generation failed: {e}") from e

        return FlashcardResponse(
            session_id=session_id,
            flashcards=flashcards[:count]
        )

    def _build_flashcard_prompt(self, context: str, count: int, card_type: FlashcardType) -> str:
        type_inst = {
            FlashcardType.QA: "Format: Q: [Question] A: [Answer]",
            FlashcardType.MCQ: "Format: Q: [Question] Options: [A, B, C, D] Correct: [Answer] Explanation: [Why]",
            FlashcardType.REVISION: "Format: Concept: [Name] Summary: [Details]"
        }

        prompt = (
            "You are an AI study assistant.\n"
            f"Generate {count} {card_type.value} items from the lecture context below.\n"
            f"{type_inst.get(card_type)}\n\n"
            "Lecture Context:\n"
            f"{context}\n\n"
            "Generated Items:"
        )
        return prompt

    def _parse_flashcards(self, text: str, card_type: FlashcardType) -> List[Flashcard]:
        cards = []
        
        if card_type == FlashcardType.QA:
            # Simple regex-based parsing
            items = re.split(r'Q:', text)
            for item in items:
                if 'A:' in item:
                    parts = item.split('A:')
                    q = parts[0].strip()
                    a = parts[1].strip()
                    if q and a:
                        cards.append(Flashcard(question=q, answer=a))
        
        elif card_type == FlashcardType.MCQ:
            # More complex parsing for MCQ
            items = re.split(r'Q:', text)
            for item in items:
                if 'Options:' in item and 'Correct:' in item:
                    q_part = item.split('Options:')[0].strip()
                    opt_part = item.split('Options:')[1].split('Correct:')[0].strip()
                    ans_part = item.split('Correct:')[1].strip()
                    
                    options = [o.strip() for o in re.split(r'[,|;]', opt_part)]
                    cards.append(Flashcard(
                        question=q_part,
                        answer=ans_part,
                        options=options
                    ))
        
        else:
            # Fallback/Revision
            items = text.split('\n\n')
            for item in items:
                if ':' in item:
                    parts = item.split(':')
                    cards.append(Flashcard(question=parts[0].strip(), answer=parts[1].strip()))

        return cards
