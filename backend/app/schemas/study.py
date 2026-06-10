from typing import List, Optional
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel
from fsrs import State, Rating

class FlashcardReviewState(BaseModel):
    id: str
    flashcard_id: str
    job_id: str
    state: int
    due: datetime
    stability: float
    difficulty: float
    elapsed_days: int
    scheduled_days: int
    reps: int
    lapses: int
    priority: float
    content: Optional[dict] = None

class StudyQueueResponse(BaseModel):
    new_cards: List[FlashcardReviewState]
    learning_cards: List[FlashcardReviewState]
    review_cards: List[FlashcardReviewState]
    total_due: int

class SubmitReviewRequest(BaseModel):
    rating: int  # 1=Again, 2=Hard, 3=Good, 4=Easy

class SubmitReviewResponse(BaseModel):
    success: bool
    next_due: datetime
