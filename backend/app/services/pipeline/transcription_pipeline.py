"""Orchestrates FFmpeg extraction, Whisper transcription, and JSON persistence."""

from __future__ import annotations

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
            t_shot = time.perf_counter()
            screenshots = self._screenshot_service.extract_sync(record.video_path, job_id=job_id)
            logger.info(
                "Job %s screenshots extracted (%d files) in %.2fs",
                job_id,
                len(screenshots),
                time.perf_counter() - t_shot,
            )

            t_ocr = time.perf_counter()
            ocr_results = self._ocr_service.run_ocr(job_id, screenshots)
            logger.info(
                "Job %s OCR processing completed in %.2fs",
                job_id,
                time.perf_counter() - t_ocr,
            )

            t_audio = time.perf_counter()
            extract_audio_wav(
                record.video_path,
                record.audio_path,
                ffmpeg_executable=self._settings.ffmpeg_path,
            )
            logger.info(
                "Job %s audio extraction completed in %.2fs",
                job_id,
                time.perf_counter() - t_audio,
            )

            t_transcribe = time.perf_counter()
            payload = self._whisper.transcribe(
                record.audio_path,
                job_id=job_id,
                source_filename=record.source_filename,
            )
            logger.info(
                "Job %s transcription completed in %.2fs",
                job_id,
                time.perf_counter() - t_transcribe,
            )

            t_chunk = time.perf_counter()
            chunks = self._chunk_service.generate_chunks(job_id, payload, ocr_results)
            logger.info(
                "Job %s multimodal chunking completed in %.2fs",
                job_id,
                time.perf_counter() - t_chunk,
            )

            t_embed = time.perf_counter()
            self._embedding_service.index_chunks(job_id, chunks)
            logger.info(
                "Job %s embedding indexing completed in %.2fs",
                job_id,
                time.perf_counter() - t_embed,
            )

            self._job_store.save_transcript(job_id, payload)
            logger.info("Pipeline finished for job %s in %.2fs", job_id, time.perf_counter() - t0)
        except ScreenshotExtractionError as e:
            logger.exception("Screenshot extraction failed for job %s", job_id)
            self._job_store.mark_failed(job_id, _truncate(str(e)))
        except OCRError as e:
            logger.exception("OCR processing failed for job %s", job_id)
            self._job_store.mark_failed(job_id, _truncate(str(e)))
        except ChunkingError as e:
            logger.exception("Chunk generation failed for job %s", job_id)
            self._job_store.mark_failed(job_id, _truncate(str(e)))
        except EmbeddingError as e:
            logger.exception("Embedding indexing failed for job %s", job_id)
            self._job_store.mark_failed(job_id, _truncate(str(e)))
        except AudioExtractionError as e:
            logger.exception("Audio extraction failed for job %s", job_id)
            self._job_store.mark_failed(job_id, _truncate(str(e)))
        except Exception as e:  # noqa: BLE001 — surface as job failure
            logger.exception("Transcription failed for job %s", job_id)
            self._job_store.mark_failed(job_id, _truncate(str(e)))


def _truncate(msg: str) -> str:
    if len(msg) <= _MAX_ERR_LEN:
        return msg
    return msg[: _MAX_ERR_LEN] + "…"
