"""faster-whisper wrapper: file in, structured transcript out."""

from __future__ import annotations

import logging
from pathlib import Path
from uuid import UUID

from app.core.config import Settings
from app.schemas.transcript import TranscriptMetadata, TranscriptPayload, TranscriptSegment

logger = logging.getLogger(__name__)


class WhisperTranscriptionService:
    """Loads the Whisper model once; transcribe() is blocking (use thread pool from caller)."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        # Local import so `import app.main` works in environments without faster-whisper
        from faster_whisper import WhisperModel

        logger.info(
            "Loading Whisper model %r (device=%s, compute_type=%s)",
            settings.whisper_model,
            settings.whisper_device,
            settings.whisper_compute_type,
        )
        self._model = WhisperModel(
            settings.whisper_model,
            device=settings.whisper_device,
            compute_type=settings.whisper_compute_type,
        )

    def transcribe(
        self,
        audio_path: Path,
        job_id: UUID,
        source_filename: str,
    ) -> TranscriptPayload:
        """Return segments with start/end/text and metadata."""
        segments_iter, info = self._model.transcribe(
            str(audio_path.resolve()),
            beam_size=5,
            vad_filter=True,
        )
        segments: list[TranscriptSegment] = []
        for seg in segments_iter:
            text = (seg.text or "").strip()
            if not text:
                continue
            segments.append(
                TranscriptSegment(start=float(seg.start), end=float(seg.end), text=text)
            )
        metadata = TranscriptMetadata(
            job_id=job_id,
            source_filename=source_filename,
            model=self._settings.whisper_model,
            language=getattr(info, "language", None),
        )
        return TranscriptPayload(metadata=metadata, segments=segments)
