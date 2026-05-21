"""Extract mono 16 kHz WAV audio from a video file using FFmpeg (subprocess)."""

from __future__ import annotations

import logging
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)


class AudioExtractionError(RuntimeError):
    """Raised when FFmpeg fails or is not available."""


def extract_audio_wav(
    video_path: Path,
    output_wav_path: Path,
    ffmpeg_executable: str = "ffmpeg",
    timeout_seconds: int = 7200,
) -> None:
    """
    Demux and decode audio to PCM WAV suitable for Whisper (16 kHz mono).

    Requires FFmpeg installed and on PATH, or set FFMPEG_PATH to the binary.
    """
    output_wav_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        ffmpeg_executable,
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        str(video_path.resolve()),
        "-vn",
        "-acodec",
        "pcm_s16le",
        "-ar",
        "16000",
        "-ac",
        "1",
        str(output_wav_path.resolve()),
    ]
    logger.info("Running FFmpeg: %s", " ".join(cmd[:6]) + " ...")
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            check=False,
        )
    except FileNotFoundError as e:
        raise AudioExtractionError(
            f"FFmpeg not found ({ffmpeg_executable!r}). "
            "Install FFmpeg and ensure it is on PATH, or set FFMPEG_PATH."
        ) from e
    except subprocess.TimeoutExpired as e:
        raise AudioExtractionError("FFmpeg timed out during audio extraction.") from e

    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "").strip()
        raise AudioExtractionError(f"FFmpeg failed (exit {proc.returncode}): {err}")
