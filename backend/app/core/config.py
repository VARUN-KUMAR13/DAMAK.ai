"""Application settings loaded from environment variables."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Optional

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Env-based configuration. No secrets committed — use `.env` locally."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = Field(default="AI Lecture Intelligence API", alias="APP_NAME")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    project_root: Path = Field(
        default_factory=lambda: Path(__file__).resolve().parents[3],
        alias="PROJECT_ROOT",
    )

    storage_uploads: Optional[Path] = Field(default=None, alias="STORAGE_UPLOADS")
    storage_audio: Optional[Path] = Field(default=None, alias="STORAGE_AUDIO")
    storage_transcripts: Optional[Path] = Field(default=None, alias="STORAGE_TRANSCRIPTS")
    storage_screenshots: Optional[Path] = Field(default=None, alias="STORAGE_SCREENSHOTS")
    storage_ocr: Optional[Path] = Field(default=None, alias="STORAGE_OCR")
    storage_chunks: Optional[Path] = Field(default=None, alias="STORAGE_CHUNKS")
    storage_embeddings: Optional[Path] = Field(default=None, alias="STORAGE_EMBEDDINGS")
    storage_live: Optional[Path] = Field(default=None, alias="STORAGE_LIVE")

    whisper_model: str = Field(default="base", alias="WHISPER_MODEL")
    whisper_device: str = Field(default="cpu", alias="WHISPER_DEVICE")
    whisper_compute_type: str = Field(default="int8", alias="WHISPER_COMPUTE_TYPE")

    ocr_lang: str = Field(default="en", alias="OCR_LANG")
    ocr_use_gpu: bool = Field(default=False, alias="OCR_USE_GPU")
    ocr_use_angle_cls: bool = Field(default=True, alias="OCR_USE_ANGLE_CLS")

    # Phase 4: Chunking
    chunk_min_words: int = Field(default=50, alias="CHUNK_MIN_WORDS")
    chunk_max_words: int = Field(default=250, alias="CHUNK_MAX_WORDS")
    chunk_overlap_sec: float = Field(default=2.0, alias="CHUNK_OVERLAP_SEC")

    # Phase 5: Embeddings & Vector DB
    embedding_model: str = Field(default="all-MiniLM-L6-v2", alias="EMBEDDING_MODEL")
    embedding_device: str = Field(default="cpu", alias="EMBEDDING_DEVICE")
    chroma_db_dir: Optional[Path] = Field(default=None, alias="CHROMA_DB_DIR")

    # Phase 6: Ollama & RAG
    ollama_base_url: str = Field(default="http://localhost:11434", alias="OLLAMA_BASE_URL")
    ollama_model: str = Field(default="phi3", alias="OLLAMA_MODEL")

    ffmpeg_path: str = Field(default="ffmpeg", alias="FFMPEG_PATH")
    screenshot_interval_sec: float = Field(default=2.0, alias="SCREENSHOT_INTERVAL_SEC")
    screenshot_ssim_threshold: float = Field(default=0.96, alias="SCREENSHOT_SSIM_THRESHOLD")
    screenshot_min_change_ratio: float = Field(
        default=0.02, alias="SCREENSHOT_MIN_CHANGE_RATIO"
    )
    screenshot_jpeg_quality: int = Field(default=90, alias="SCREENSHOT_JPEG_QUALITY")

    max_upload_mb: int = Field(default=500, alias="MAX_UPLOAD_MB")

    @model_validator(mode="after")
    def _default_storage_layout(self) -> "Settings":
        root = self.project_root
        if self.storage_uploads is None:
            self.storage_uploads = root / "storage" / "uploads"
        if self.storage_audio is None:
            self.storage_audio = root / "storage" / "audio"
        if self.storage_transcripts is None:
            self.storage_transcripts = root / "storage" / "transcripts"
        if self.storage_screenshots is None:
            self.storage_screenshots = root / "storage" / "screenshots"
        if self.storage_ocr is None:
            self.storage_ocr = root / "storage" / "ocr"
        if self.storage_chunks is None:
            self.storage_chunks = root / "storage" / "chunks"
        if self.storage_embeddings is None:
            self.storage_embeddings = root / "storage" / "embeddings"
        if self.storage_live is None:
            self.storage_live = root / "storage" / "live"
        if self.chroma_db_dir is None:
            self.chroma_db_dir = self.storage_embeddings / "chroma_db"
        return self


@lru_cache
def get_settings() -> Settings:
    """Cached settings singleton for FastAPI Depends."""
    return Settings()
