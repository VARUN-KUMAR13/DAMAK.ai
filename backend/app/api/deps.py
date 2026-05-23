"""FastAPI dependency providers (simple factory / request state pattern)."""

from typing_extensions import Annotated

from fastapi import Depends, Request

from app.core.config import Settings, get_settings
from app.services.pipeline.transcription_pipeline import TranscriptionPipeline
from app.services.embeddings.embedding_service import EmbeddingService
from app.services.storage.job_store import JobStore


def _get_job_store(request: Request) -> JobStore:
    return request.app.state.job_store


def _get_pipeline(request: Request) -> TranscriptionPipeline:
    return request.app.state.pipeline


def _get_embedding_service(request: Request) -> EmbeddingService:
    return request.app.state.embedding_service


def _settings_dependency() -> Settings:
    return get_settings()


SettingsDep = Annotated[Settings, Depends(_settings_dependency)]
JobStoreDep = Annotated[JobStore, Depends(_get_job_store)]
PipelineDep = Annotated[TranscriptionPipeline, Depends(_get_pipeline)]
EmbeddingDep = Annotated[EmbeddingService, Depends(_get_embedding_service)]
