"""Job creation and transcript retrieval."""

from __future__ import annotations

import asyncio
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile

from app.api.deps import EmbeddingDep, JobStoreDep, PipelineDep, SettingsDep
from app.schemas.job import JobCreateResponse, JobDetailResponse, JobStatus
from app.schemas.search import SearchRequest, SearchResponse
from app.schemas.transcript import TranscriptPayload
from app.services.pipeline.transcription_pipeline import TranscriptionPipeline

router = APIRouter()


async def _run_pipeline_async(
    pipeline: TranscriptionPipeline,
    job_id: UUID,
) -> None:
    """Run blocking FFmpeg + Whisper work off the event loop."""
    await asyncio.to_thread(pipeline.run_sync, job_id)


@router.post(
    "/jobs",
    response_model=JobCreateResponse,
    summary="Upload a local video file and start transcription",
)
async def create_job(
    settings: SettingsDep,
    job_store: JobStoreDep,
    pipeline: PipelineDep,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="Video file (any format FFmpeg supports)."),
) -> JobCreateResponse:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Uploaded file must have a filename.")
    data = await file.read()
    max_bytes = settings.max_upload_mb * 1024 * 1024
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds maximum size of {settings.max_upload_mb} MiB.",
        )
    record = job_store.create_job(file.filename, data)
    background_tasks.add_task(_run_pipeline_async, pipeline, record.job_id)
    return JobCreateResponse(job_id=record.job_id, status=JobStatus.PENDING)


@router.get(
    "/jobs/{job_id}",
    response_model=JobDetailResponse,
    summary="Get job status and transcript when ready",
)
def get_job(job_id: UUID, job_store: JobStoreDep) -> JobDetailResponse:
    rec = job_store.get(job_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    transcript: Optional[TranscriptPayload] = None
    ocr_results: Optional[list[dict]] = None
    chunks: Optional[list[dict]] = None
    tpath: Optional[str] = None
    if rec.transcript_path is not None:
        tpath = str(rec.transcript_path.resolve())
    if rec.status == JobStatus.COMPLETED:
        transcript = job_store.load_transcript(job_id)
        ocr_results = job_store.load_ocr_results(job_id)
        chunks = job_store.load_chunks(job_id)
    return JobDetailResponse(
        job_id=rec.job_id,
        status=rec.status,
        source_filename=rec.source_filename,
        error_message=rec.error_message,
        transcript_path=tpath,
        transcript=transcript,
        ocr_results=ocr_results,
        chunks=chunks,
    )


@router.get(
    "/transcripts/{job_id}",
    response_model=TranscriptPayload,
    summary="Get completed transcript JSON payload only",
)
def get_transcript(job_id: UUID, job_store: JobStoreDep) -> TranscriptPayload:
    payload = job_store.load_transcript(job_id)
    if payload is None:
        raise HTTPException(
            status_code=404,
            detail="Transcript not found or job not completed yet.",
        )
    return payload


@router.post(
    "/search",
    response_model=SearchResponse,
    summary="Global semantic search across all processed lectures",
)
def search_global(
    request: SearchRequest,
    embeddings: EmbeddingDep,
) -> SearchResponse:
    results = embeddings.search_similar_chunks(
        query=request.query,
        job_id=request.job_id,
        limit=request.limit
    )
    return SearchResponse(
        query=request.query,
        results=results,
        total_matches=len(results)
    )


@router.get(
    "/search/{job_id}",
    response_model=SearchResponse,
    summary="Semantic search within a specific lecture",
)
def search_job(
    job_id: UUID,
    query: str,
    embeddings: EmbeddingDep,
    limit: int = 5
) -> SearchResponse:
    results = embeddings.search_similar_chunks(
        query=query,
        job_id=job_id,
        limit=limit
    )
    return SearchResponse(
        query=query,
        results=results,
        total_matches=len(results)
    )
