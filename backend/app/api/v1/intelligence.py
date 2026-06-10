"""Intelligence API endpoints for notes and flashcards."""

from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.api.deps import NotesDep, FlashcardDep
from app.schemas.intelligence import NotesRequest, NotesResponse, FlashcardRequest, FlashcardResponse

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post(
    "/notes/generate",
    response_model=NotesResponse,
    summary="Generate structured AI notes for a session",
)
async def generate_notes(
    request: NotesRequest,
    notes_service: NotesDep,
) -> NotesResponse:
    try:
        return await notes_service.generate_notes(request.session_id, request.mode)
    except Exception as e:
        logger.error("Notes generation error: %s", e)
        error_msg = str(e) if isinstance(e, RuntimeError) else "Failed to generate notes."
        raise HTTPException(status_code=500, detail=error_msg)


@router.post(
    "/flashcards/generate",
    response_model=FlashcardResponse,
    summary="Generate study flashcards for a session",
)
async def generate_flashcards(
    request: FlashcardRequest,
    flashcard_service: FlashcardDep,
) -> FlashcardResponse:
    try:
        return await flashcard_service.generate_flashcards(
            request.session_id, 
            request.count, 
            request.type
        )
    except Exception as e:
        logger.error("Flashcard generation error: %s", e)
        error_msg = str(e) if isinstance(e, RuntimeError) else "Failed to generate flashcards."
        raise HTTPException(status_code=500, detail=error_msg)
