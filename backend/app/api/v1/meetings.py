from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List

from app.api.deps import MeetingServiceDep, MeetingStoreDep, MeetingServiceWSDep
from app.schemas.meeting import LiveMeetingCreate, LiveMeetingResponse, TranscriptChunkPayload, TranscriptChunkResponse

router = APIRouter()

@router.get("", response_model=List[LiveMeetingResponse], summary="List active meetings")
async def list_meetings(store: MeetingStoreDep) -> List[LiveMeetingResponse]:
    meetings = store.meetings.values()
    active_meetings = [
        LiveMeetingResponse(
            session_id=m["session_id"],
            title=m["title"],
            platform=m["platform"],
            status=m["status"],
            created_at=m["created_at"]
        ) for m in meetings if m["status"] == "active"
    ]
    return active_meetings

@router.get("/{session_id}", response_model=LiveMeetingResponse, summary="Get active meeting details")
async def get_meeting(session_id: str, store: MeetingStoreDep) -> LiveMeetingResponse:
    m = store.get_meeting(session_id)
    if not m:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Meeting not found")
    return LiveMeetingResponse(
        session_id=m["session_id"],
        title=m["title"],
        platform=m["platform"],
        status=m["status"],
        created_at=m["created_at"]
    )

@router.post("/start", response_model=LiveMeetingResponse, summary="Start a new live meeting capture")
async def start_meeting(
    payload: LiveMeetingCreate,
    service: MeetingServiceDep,
) -> LiveMeetingResponse:
    return service.start_meeting(payload.title, payload.platform)

@router.post("/{session_id}/transcript", response_model=TranscriptChunkResponse, summary="Ingest a new text chunk")
async def add_transcript_chunk(
    session_id: str,
    payload: TranscriptChunkPayload,
    service: MeetingServiceDep,
) -> TranscriptChunkResponse:
    return await service.add_transcript_chunk(session_id, payload)

@router.post("/{session_id}/end", summary="End the live meeting and trigger processing")
async def end_meeting(
    session_id: str,
    service: MeetingServiceDep,
):
    await service.end_meeting(session_id)
    return {"status": "ok"}

@router.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str, service: MeetingServiceWSDep):
    try:
        await service.manager.connect(websocket, session_id)
        # Send a connection confirmation message
        await websocket.send_json({"type": "system", "status": "connected", "message": "WebSocket connected successfully."})
        while True:
            # We don't expect messages from the client right now, but we need to keep the connection open
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        service.manager.disconnect(websocket, session_id)
    except Exception as e:
        import logging
        logging.error(f"WebSocket error for session {session_id}: {e}")
        service.manager.disconnect(websocket, session_id)
