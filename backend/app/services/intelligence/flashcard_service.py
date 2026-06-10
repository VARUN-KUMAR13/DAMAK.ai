"""Service for generating flashcards and quiz content."""

from __future__ import annotations

import json
import logging
import re
import uuid
from typing import List, Optional
from uuid import UUID

from app.core.config import Settings
from app.schemas.intelligence import Flashcard, FlashcardType, FlashcardResponse
from app.services.llm.ollama_service import OllamaService
from app.services.storage.job_store import JobStore
from app.services.study.study_service import StudyService

logger = logging.getLogger(__name__)


class FlashcardService:
    """Generates study materials like flashcards and MCQs."""

    def __init__(
        self,
        settings: Settings,
        job_store: JobStore,
        ollama_service: OllamaService,
        study_service: StudyService
    ) -> None:
        self._settings = settings
        self._job_store = job_store
        self._ollama = ollama_service
        self._study = study_service

    async def generate_flashcards(self, session_id: UUID, count: int, card_type: FlashcardType) -> FlashcardResponse:
        """
        Generate flashcards for a session.
        """
        logger.info("Generating %d %s flashcards for session %s", count, card_type, session_id)
        
        chunks_data = self._job_store.load_chunks(session_id)
        if not chunks_data:
            return FlashcardResponse(
                session_id=session_id,
                flashcards=[]
            )

        # Chunk sampling strategy to avoid overwhelming the LLM
        max_chunks = 20
        if len(chunks_data) > max_chunks:
            step = len(chunks_data) / max_chunks
            sampled_chunks = [chunks_data[int(i * step)] for i in range(max_chunks)]
        else:
            sampled_chunks = chunks_data

        context = "\n".join([f"Chunk {i+1}: {c.get('combined_text', c.get('spoken_text', ''))}" for i, c in enumerate(sampled_chunks)])

        prompt = self._build_flashcard_prompt(context, count, card_type)

        try:
            raw_response = await self._ollama.generate_response(prompt, json_format=True)
            logger.info("RAW OLLAMA RESPONSE: %s", raw_response)
            
            structured_output = self._parse_json_structure(raw_response)
            logger.info("PARSED JSON STRUCTURE: %s", json.dumps(structured_output, indent=2))
            
            flashcards = []
            flashcards_data = []
            
            for item in structured_output:
                fc_id = str(uuid.uuid4())
                
                # Priority heuristically set by type (e.g., MCQ = 0.8, QA = 0.6)
                priority = 0.8 if card_type.value == "mcq" else 0.6
                
                flashcards_data.append({
                    "id": fc_id,
                    "priority": priority
                })

                # Lowercase all keys to handle LLM casing hallucinations
                item_lower = {k.lower(): v for k, v in item.items() if isinstance(k, str)}
                
                question_val = item_lower.get("question", item_lower.get("concept", item_lower.get("q", item_lower.get("query", item_lower.get("front", "")))))
                answer_val = item_lower.get("answer", item_lower.get("summary", item_lower.get("a", item_lower.get("response", item_lower.get("back", "")))))
                options_val = item_lower.get("options", item_lower.get("choices", []))
                timestamp_val = item_lower.get("timestamp", item_lower.get("time", None))

                # Bulletproof fallback for aggressively hallucinated keys
                if not question_val and not answer_val and len(item_lower) >= 2:
                    keys = list(item_lower.keys())
                    # filter out known metadata keys
                    content_keys = [k for k in keys if k not in ["type", "options", "choices", "timestamp", "time", "chunk_id", "id"]]
                    if len(content_keys) >= 2:
                        question_val = str(item_lower.get(content_keys[0], ""))
                        answer_val = str(item_lower.get(content_keys[1], ""))

                flashcards.append(Flashcard(
                    id=fc_id,
                    type=item_lower.get("type", card_type.value),
                    question=question_val,
                    answer=answer_val,
                    options=options_val,
                    timestamp=timestamp_val,
                    chunk_id=item_lower.get("chunk_id")
                ))

            logger.info("FINAL FLASHCARD OBJECTS: %s", [fc.dict() for fc in flashcards])
            self._job_store.save_flashcards(session_id, [fc.dict() for fc in flashcards])
            
            # Sync to Spaced Repetition Engine
            try:
                self._study.sync_flashcards(str(session_id), flashcards_data)
                logger.info(f"Synced {len(flashcards_data)} flashcards to SRS for job {session_id}")
            except Exception as e:
                logger.error(f"Failed to sync flashcards to SRS: {e}")

            logger.info("Successfully generated and saved %d flashcards for job %s", len(flashcards), session_id)
            
        except Exception as e:
            logger.error("Failed to generate flashcards: %s", e)
            raise RuntimeError(f"Flashcard generation failed: {e}") from e

        return FlashcardResponse(
            session_id=session_id,
            flashcards=flashcards[:count]
        )

    def _build_flashcard_prompt(self, context: str, count: int, card_type: FlashcardType) -> str:
        type_inst = {
            FlashcardType.QA: 'Each object must have "question", "answer", and "timestamp" properties. "timestamp" must be a number (seconds).',
            FlashcardType.MCQ: 'Each object must have "question", "options" (array of exactly 4 strings), "answer" (string matching exactly one option), and "timestamp" (number in seconds).',
            FlashcardType.REVISION: 'Each object must have "concept", "summary", and "timestamp" (number in seconds) properties.'
        }

        prompt = (
            "You are an AI study assistant.\n"
            f"Generate exactly {count} {card_type.value} items from the lecture context below.\n"
            "You MUST return the output ONLY as a valid JSON array of objects.\n"
            f"{type_inst.get(card_type, '')}\n\n"
            "Lecture Context:\n"
            f"{context}\n\n"
            "Respond ONLY with the raw JSON array. Do not include markdown blocks or any other text."
        )
        return prompt

    def _parse_json_structure(self, text: str) -> List[dict]:
        try:
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()
                
            data = json.loads(text)
            if not isinstance(data, list):
                if isinstance(data, dict) and "flashcards" in data:
                    data = data["flashcards"]
                elif isinstance(data, dict) and "items" in data:
                    data = data["items"]
                else:
                    data = [data]
            return data
        except Exception as e:
            logger.error("Failed to parse JSON flashcards: %s", e)
            return []
