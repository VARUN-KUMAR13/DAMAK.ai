from __future__ import annotations

import asyncio
import logging
from typing import Optional, Any
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile, Form

from app.api.deps import LiveSessionDep, PipelineDep
from app.schemas.live_session import LiveSessionCreate, LiveSessionResponse, LiveSessionDetail, SessionStatus

logger = logging.getLogger(__name__)

router = APIRouter()


async def _run_pipeline_async(
    pipeline: Any, # TranscriptionPipeline
    job_id: UUID,
) -> None:
    """Run processing work off the event loop."""
    await asyncio.to_thread(pipeline.run_sync, job_id)


@router.post("/start", response_model=LiveSessionResponse, summary="Start a new live capture session")
async def start_session(
    payload: LiveSessionCreate,
    live_service: LiveSessionDep,
) -> LiveSessionResponse:
    return live_service.start_session(payload.title)


@router.get("/sessions", response_model=list[LiveSessionDetail], summary="List all active live capture sessions")
async def list_active_sessions(
    live_service: LiveSessionDep,
) -> list[LiveSessionDetail]:
    return live_service.list_active_sessions()


@router.post("/{session_id}/upload-screenshot", summary="Upload a screenshot to an active session")
async def upload_screenshot(
    session_id: UUID,
    live_service: LiveSessionDep,
    timestamp: float = Form(..., description="Timestamp of the screenshot in seconds"),
    file: UploadFile = File(...),
) -> dict:
    data = await file.read()
    ok = await live_service.add_screenshot(session_id, data, timestamp)
    # We don't raise 400 if add_screenshot returns False, because it might just be a duplicate frame.
    # However, if the session doesn't exist at all, we should probably return 404, but LiveSessionService handles that internally by returning False.
    # We will just return 200 OK regardless to prevent console spam for skipped frames.
    return {"status": "ok", "saved": ok}


@router.post("/{session_id}/upload-audio", summary="Upload an audio chunk to an active session")
async def upload_audio(
    session_id: UUID,
    live_service: LiveSessionDep,
    file: UploadFile = File(...),
) -> dict:
    data = await file.read()
    ok = await live_service.add_audio_chunk(session_id, data)
    if not ok:
        # If audio chunk fails, it means session is definitely inactive/missing
        raise HTTPException(status_code=404, detail="Live session not found or inactive.")
    return {"status": "ok"}


@router.post("/{session_id}/stop", response_model=LiveSessionDetail, summary="Stop and process a live session")
async def stop_session(
    session_id: UUID,
    background_tasks: BackgroundTasks,
    live_service: LiveSessionDep,
    pipeline: PipelineDep,
) -> LiveSessionDetail:
    try:
        logger.info("Stopping live session: %s", session_id)
        detail = live_service.stop_session(session_id)
        if not detail:
            logger.warning("Stop session failed: Session %s not found", session_id)
            raise HTTPException(status_code=404, detail="Session not found.")
        
        # Trigger processing pipeline in background
        # Use background_tasks to ensure we don't block the request
        background_tasks.add_task(_run_pipeline_async, pipeline, session_id)
        
        # Explicitly set status to processing for immediate feedback
        detail.status = SessionStatus.PROCESSING
        logger.info("Session %s stopped successfully, processing started in background", session_id)
        return detail

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error while stopping live session %s", session_id)
        raise HTTPException(status_code=500, detail=f"Failed to stop session: {str(e)}")


@router.get("/{session_id}", response_model=LiveSessionDetail, summary="Get live session status")
async def get_session(
    session_id: UUID,
    live_service: LiveSessionDep,
) -> LiveSessionDetail:
    detail = live_service.get_session(session_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Session not found.")
    return detail
