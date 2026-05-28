"""Intelligence schemas for notes and flashcards."""

from __future__ import annotations

from enum import Enum
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field


class NotesMode(str, Enum):
    EASY = "easy"
    STANDARD = "standard"
    DEEP = "deep"
    AS_IS = "as_is"
    EXAM = "exam"


class NotesRequest(BaseModel):
    session_id: UUID
    mode: NotesMode = NotesMode.STANDARD


class NotesResponse(BaseModel):
    session_id: UUID
    title: str
    mode: NotesMode
    content: str = Field(..., description="Markdown content of the generated notes")
    key_concepts: List[str] = Field(default_factory=list)
    citations: List[dict] = Field(default_factory=list)


class FlashcardType(str, Enum):
    QA = "qa"
    MCQ = "mcq"
    REVISION = "revision"


class FlashcardRequest(BaseModel):
    session_id: UUID
    count: int = 5
    type: FlashcardType = FlashcardType.QA


class Flashcard(BaseModel):
    question: str
    answer: str
    options: Optional[List[str]] = None
    explanation: Optional[str] = None
    chunk_id: Optional[str] = None
    timestamp: Optional[float] = None


class FlashcardResponse(BaseModel):
    session_id: UUID
    flashcards: List[Flashcard]
