"""Media processing (e.g. FFmpeg audio extraction)."""

from app.services.media.audio_extract import AudioExtractionError, extract_audio_wav

__all__ = ["AudioExtractionError", "extract_audio_wav"]
