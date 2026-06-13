"""Orchestrates FFmpeg extraction, Whisper transcription, and JSON persistence."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from uuid import UUID

from app.core.config import Settings
from app.schemas.job import JobStatus
from app.services.media.audio_extract import AudioExtractionError, extract_audio_wav
from app.services.media.screenshot_extract import (
    ScreenshotExtractionError,
    ScreenshotExtractionService,
)
from app.services.ocr.ocr_service import OCRError, OCRService
from app.services.pipeline.chunk_service import ChunkingError, ChunkService
from app.services.embeddings.embedding_service import EmbeddingError, EmbeddingService
from app.services.storage.job_store import JobStore
from app.services.transcription.whisper_service import WhisperTranscriptionService

logger = logging.getLogger(__name__)

_MAX_ERR_LEN = 4000


class TranscriptionPipeline:
    """`run_sync` is blocking; schedule it with `asyncio.to_thread` from route/background tasks."""

    def __init__(
        self,
        settings: Settings,
        job_store: JobStore,
        whisper: WhisperTranscriptionService,
        screenshot_service: ScreenshotExtractionService,
        ocr_service: OCRService,
        chunk_service: ChunkService,
        embedding_service: EmbeddingService,
    ) -> None:
        self._settings = settings
        self._job_store = job_store
        self._whisper = whisper
        self._screenshot_service = screenshot_service
        self._ocr_service = ocr_service
        self._chunk_service = chunk_service
        self._embedding_service = embedding_service

    def run_sync(self, job_id: UUID) -> None:
        t0 = time.perf_counter()
        record = self._job_store.get(job_id)
        if record is None:
            logger.error("Pipeline: missing job %s", job_id)
            return
        logger.info("Pipeline started for job %s", job_id)
        self._job_store.update_status(job_id, JobStatus.PROCESSING)
        try:
            # 1. Screenshots (Skip if already provided by live capture)
            if record.screenshots_metadata_path and record.screenshots_metadata_path.exists():
                logger.info("Job %s: Using existing screenshots from live capture", job_id)
                self._job_store.update_stage(job_id, "Extracting Screenshots")
                # Load existing metadata
                with open(record.screenshots_metadata_path, "r", encoding="utf-8") as f:
                    screenshots = json.load(f)
            else:
                if not record.video_path:
                    raise ScreenshotExtractionError("No video path or pre-extracted screenshots found.")

                self._job_store.update_stage(job_id, "Extracting Screenshots")
                t_shot = time.perf_counter()
                screenshots = self._screenshot_service.extract_sync(record.video_path, job_id=job_id)
                logger.info(
                    "Job %s screenshots extracted (%d files) in %.2fs",
                    job_id,
                    len(screenshots),
                    time.perf_counter() - t_shot,
                )

            logger.info("Job %s: Starting OCR processing on %d screenshots...", job_id, len(screenshots))
            self._job_store.update_stage(job_id, "Running OCR")
            t_ocr = time.perf_counter()
            ocr_results = self._ocr_service.run_ocr(job_id, screenshots)
            logger.info(
                "Job %s: OCR processing completed (found text in %d slides) in %.2fs",
                job_id,
                len(ocr_results),
                time.perf_counter() - t_ocr,
            )

            # 2. Audio (Skip extraction if already provided by live capture)
            if not record.audio_path or not record.audio_path.exists():
                if not record.video_path:
                    raise AudioExtractionError("No video path or pre-extracted audio found.")

                logger.info("Job %s: Starting Whisper transcription...", job_id)
                self._job_store.update_stage(job_id, "Extracting Audio")
                t_audio = time.perf_counter()
                extract_audio_wav(
                    record.video_path,
                    record.audio_path,
                    ffmpeg_executable=self._settings.ffmpeg_path,
                )
                logger.info(
                    "Job %s: Audio extraction completed in %.2fs",
                    job_id,
                    time.perf_counter() - t_audio,
                )
            else:
                logger.info("Job %s: Using existing audio from live capture", job_id)

            logger.info("Job %s: Starting Whisper transcription on audio file...", job_id)
            self._job_store.update_stage(job_id, "Transcribing Speech")
            t_transcribe = time.perf_counter()
            payload = self._whisper.transcribe(
                audio_path=record.audio_path,
                job_id=job_id,
                source_filename=record.source_filename
            )
            logger.info(
                "Job %s: Whisper transcription completed (%d segments) in %.2fs",
                job_id,
                len(payload.segments),
                time.perf_counter() - t_transcribe,
            )

            logger.info("Job %s: Starting multimodal chunking...", job_id)
            self._job_store.update_stage(job_id, "Generating Embeddings")
            t_chunk = time.perf_counter()
            chunks = self._chunk_service.generate_chunks(job_id, payload, ocr_results)
            logger.info(
                "Job %s: Multimodal chunking completed (generated %d chunks) in %.2fs",
                job_id,
                len(chunks),
                time.perf_counter() - t_chunk,
            )

            logger.info("Job %s: Starting embedding indexing...", job_id)
            self._job_store.update_stage(job_id, "Finalizing Session")
            t_embed = time.perf_counter()
            self._embedding_service.index_chunks(job_id, chunks)
            logger.info(
                "Job %s: Embedding indexing completed in %.2fs",
                job_id,
                time.perf_counter() - t_embed,
            )

            self._job_store.save_transcript(job_id, payload)
            self._job_store.update_status(job_id, JobStatus.COMPLETED)
            logger.info("Pipeline completed successfully for job %s", job_id)

            logger.info("Pipeline finished for job %s in %.2fs", job_id, time.perf_counter() - t0)
        except ScreenshotExtractionError as e:
            logger.exception("Screenshot extraction failed for job %s", job_id)
            self._job_store.mark_failed(job_id, _truncate(str(e)))
            self._job_store.update_stage(job_id, "Failed during screenshot extraction")
        except OCRError as e:
            logger.exception("OCR processing failed for job %s", job_id)
            self._job_store.mark_failed(job_id, _truncate(str(e)))
            self._job_store.update_stage(job_id, "Failed during OCR processing")
        except ChunkingError as e:
            logger.exception("Chunk generation failed for job %s", job_id)
            self._job_store.mark_failed(job_id, _truncate(str(e)))
            self._job_store.update_stage(job_id, "Failed during semantic chunking")
        except EmbeddingError as e:
            logger.exception("Embedding indexing failed for job %s", job_id)
            self._job_store.mark_failed(job_id, _truncate(str(e)))
            self._job_store.update_stage(job_id, "Failed during embedding generation")
        except AudioExtractionError as e:
            logger.exception("Audio extraction failed for job %s", job_id)
            self._job_store.mark_failed(job_id, _truncate(str(e)))
            self._job_store.update_stage(job_id, "Failed during audio extraction")
        except Exception as e:  # noqa: BLE001 — surface as job failure
            logger.exception("Transcription failed for job %s", job_id)
            self._job_store.mark_failed(job_id, _truncate(str(e)))
            self._job_store.update_stage(job_id, "Failed during transcription pipeline")


def _truncate(msg: str) -> str:
    if len(msg) <= _MAX_ERR_LEN:
        return msg
    return msg[: _MAX_ERR_LEN] + "…"
