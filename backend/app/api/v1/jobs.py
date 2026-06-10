"""Job creation and transcript retrieval."""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile

from app.api.deps import EmbeddingDep, JobStoreDep, OllamaDep, PipelineDep, SettingsDep
from app.schemas.chat import ChatRequest, ChatResponse, RetrievedSource
from app.services.llm.context_manager import ContextManager
from app.schemas.job import JobCreateResponse, JobDetailResponse, JobStatus
from app.schemas.search import SearchRequest, SearchResponse
from app.schemas.transcript import TranscriptPayload
from app.services.llm.ollama_service import build_rag_prompt
from app.services.pipeline.transcription_pipeline import TranscriptionPipeline

logger = logging.getLogger(__name__)

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
    "/jobs",
    response_model=list[JobDetailResponse],
    summary="List all lecture sessions/jobs",
)
def list_jobs(job_store: JobStoreDep) -> list[JobDetailResponse]:
    records = job_store.list_all()
    results = []
    for rec in records:
        results.append(
            JobDetailResponse(
                job_id=rec.job_id,
                status=rec.status,
                source_filename=rec.source_filename,
                error_message=rec.error_message,
                created_at=rec.created_at,
                progress_stage=rec.progress_stage,
            )
        )
    return results


@router.get(
    "/jobs/{job_id}",
    response_model=JobDetailResponse,
    summary="Get job details, status, transcript, OCR results, and chunks",
)
def get_job(job_id: UUID, job_store: JobStoreDep) -> JobDetailResponse:
    rec = job_store.get(job_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Job not found")

    transcript: Optional[TranscriptPayload] = None
    ocr_results: Optional[list[dict]] = None
    chunks: Optional[list[dict]] = None
    tpath: Optional[str] = None
    if rec.transcript_path is not None:
        tpath = str(rec.transcript_path.resolve())
    
    # Always try to load if status is completed, or if they exist
    transcript = job_store.load_transcript(job_id)
    ocr_results = job_store.load_ocr_results(job_id)
    chunks = job_store.load_chunks(job_id)
    
    # Force status to completed if chunks exist but status is still pending/processing
    current_status = rec.status
    if chunks and current_status != JobStatus.COMPLETED:
        current_status = JobStatus.COMPLETED

    return JobDetailResponse(
        job_id=rec.job_id,
        status=current_status,
        source_filename=rec.source_filename,
        error_message=rec.error_message,
        created_at=rec.created_at,
        progress_stage=rec.progress_stage,
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
    results = embeddings.search_hybrid(
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
    results = embeddings.search_hybrid(
        query=query,
        job_id=job_id,
        limit=limit
    )
    return SearchResponse(
        query=query,
        results=results,
        total_matches=len(results)
    )


@router.post(
    "/chat",
    response_model=ChatResponse,
    summary="Multimodal RAG Chat: Ask questions about lectures",
)
async def chat_rag(
    request: ChatRequest,
    embeddings: EmbeddingDep,
    ollama: OllamaDep,
) -> ChatResponse:
    t0 = time.perf_counter()
    
    # 1. Retrieve relevant chunks
    logger.info("Chat: Retrieving context for query: '%s'", request.question)
    retrieved_chunks = embeddings.search_hybrid(
        query=request.question,
        job_id=request.job_id,
        limit=request.top_k
    )
    
    if not retrieved_chunks:
        return ChatResponse(
            answer="I could not find any relevant information in the lecture context to answer your question.",
            sources=[]
        )

    # 2. Build RAG prompt
    prompt = build_rag_prompt(request.question, retrieved_chunks)
    
    # 3. Generate response via Ollama
    try:
        answer = await ollama.generate_response(prompt)
    except Exception as e:
        logger.error("Chat: LLM generation failed: %s", e)
        raise HTTPException(status_code=503, detail="Local LLM service is currently unavailable.")

    # 4. Format sources
    sources = [
        RetrievedSource(
            chunk_id=c.chunk_id,
            score=c.score,
            spoken_text=c.spoken_text,
            slide_text=c.slide_text,
            screenshots=c.screenshots,
            start_time=c.start_time,
            end_time=c.end_time
        )
        for c in retrieved_chunks
    ]

    logger.info("Chat: Generated RAG response in %.2fs", time.perf_counter() - t0)
    
    return ChatResponse(
        answer=answer,
        sources=sources
    )


@router.post(
    "/chat/global",
    response_model=ChatResponse,
    summary="Global Multimodal RAG Chat: Ask questions across ALL lectures",
)
async def chat_global_rag(
    request: ChatRequest,
    embeddings: EmbeddingDep,
    ollama: OllamaDep,
) -> ChatResponse:
    t0 = time.perf_counter()
    
    # 1. Retrieve relevant chunks globally (job_id = None)
    logger.info("Global Chat: Retrieving global context for query: '%s'", request.question)
    retrieved_chunks = embeddings.search_hybrid(
        query=request.question,
        job_id=None,
        limit=max(10, request.top_k * 2)  # Retrieve more context globally
    )
    
    if not retrieved_chunks:
        return ChatResponse(
            answer="I could not find any relevant information in your knowledge base to answer your question.",
            sources=[]
        )

    # 2. Build RAG prompt with multi-source instructions using ContextManager
    context_manager = ContextManager()
    context_text = context_manager.build_chat_context(request.question, retrieved_chunks, max_context_tokens=4000)
    
    prompt = (
        f"You are DAMAK AI, an intelligent personal knowledge assistant.\n"
        f"Synthesize an answer using ONLY the provided contexts from multiple lectures.\n"
        f"Explicitly mention which lecture or context the information comes from if combining ideas.\n\n"
        f"Contexts:\n{context_text}\n\n"
        f"Question: {request.question}\n\n"
        f"Answer:"
    )
    
    # 3. Generate response via Ollama
    try:
        answer = await ollama.generate_response(prompt)
    except Exception as e:
        logger.error("Global Chat: LLM generation failed: %s", e)
        raise HTTPException(status_code=503, detail="Local LLM service is currently unavailable.")

    # 4. Format sources
    sources = [
        RetrievedSource(
            chunk_id=c.chunk_id,
            score=c.score,
            spoken_text=c.spoken_text,
            slide_text=c.slide_text,
            screenshots=c.screenshots,
            start_time=c.start_time,
            end_time=c.end_time
        )
        for c in retrieved_chunks
    ]

    logger.info("Global Chat: Generated RAG response in %.2fs", time.perf_counter() - t0)
    
    return ChatResponse(
        answer=answer,
        sources=sources
    )
