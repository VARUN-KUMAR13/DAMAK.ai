"""API Router for Spaced Repetition Study System."""

from fastapi import APIRouter, Depends, HTTPException, Request
from typing import Annotated
from datetime import datetime

from app.core.config import Settings, get_settings
from app.services.study.study_service import StudyService
from app.schemas.study import StudyQueueResponse, SubmitReviewRequest, SubmitReviewResponse

router = APIRouter(prefix="/study", tags=["Study"])

def get_study_service(request: Request, settings: Annotated[Settings, Depends(get_settings)]) -> StudyService:
    return StudyService(settings, request.app.state.job_store)

StudyDep = Annotated[StudyService, Depends(get_study_service)]

@router.get("/queue", response_model=StudyQueueResponse)
async def get_study_queue(study: StudyDep) -> StudyQueueResponse:
    """Retrieve the daily study queue following Review First Principle."""
    try:
        return study.get_daily_queue()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/review/{review_id}", response_model=SubmitReviewResponse)
async def submit_review(review_id: str, request: SubmitReviewRequest, study: StudyDep) -> SubmitReviewResponse:
    """Submit a rating for a specific flashcard review state."""
    if request.rating not in [1, 2, 3, 4]:
        raise HTTPException(status_code=400, detail="Rating must be 1, 2, 3, or 4.")
    try:
        next_due = study.submit_review(review_id, request.rating)
        return SubmitReviewResponse(success=True, next_due=next_due)
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
