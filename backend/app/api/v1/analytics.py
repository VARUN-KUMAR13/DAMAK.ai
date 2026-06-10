"""API Router for Analytics and Learning Timeline endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Request
from typing import Annotated

from app.core.config import Settings, get_settings
from app.services.study.study_service import StudyService

router = APIRouter(prefix="/analytics", tags=["Analytics"])

def get_study_service(request: Request, settings: Annotated[Settings, Depends(get_settings)]) -> StudyService:
    return request.app.state.study_service

StudyDep = Annotated[StudyService, Depends(get_study_service)]

@router.get("/dashboard")
async def get_dashboard_stats(study: StudyDep):
    """Returns aggregated stats for the Learning Dashboard."""
    try:
        # Mocking complex aggregations for now until study schema fills with real history.
        # Real implementation would query the `flashcard_reviews` and `study_analytics`
        with study._get_conn() as conn:
            learned = conn.execute("SELECT COUNT(*) as c FROM flashcard_reviews WHERE state != 0").fetchone()['c']
            due = conn.execute("SELECT COUNT(*) as c FROM flashcard_reviews WHERE due <= datetime('now')").fetchone()['c']
            
        return {
            "cards_learned": learned,
            "cards_due": due,
            "retention_rate": 85.5, # Placeholder for FSRS stability avg
            "streak_days": 3
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/timeline")
async def get_learning_timeline(request: Request):
    """Returns a timeline of knowledge growth based on Graph nodes."""
    try:
        graph = request.app.state.graph_service
        # Fetch concept nodes created
        with graph._get_conn() as conn:
            nodes = conn.execute("SELECT label, type FROM nodes LIMIT 50").fetchall()
            
        return {
            "timeline": [
                {"date": "This Week", "concepts": [n['label'] for n in nodes if n['type'] == 'Concept']}
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
