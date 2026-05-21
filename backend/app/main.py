"""FastAPI application entrypoint."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator, Optional, get_args

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic.json_schema import CoreSchemaOrFieldType, GenerateJsonSchema

from app.api.v1.router import router as v1_router
from app.core.config import Settings, get_settings
from app.core.logging import setup_logging
from app.services.pipeline.transcription_pipeline import TranscriptionPipeline
from app.services.media.screenshot_extract import ScreenshotExtractionService
from app.services.ocr.ocr_service import OCRService
from app.services.storage.job_store import JobStore
from app.services.transcription.whisper_service import WhisperTranscriptionService


def _flatten_core_schema_keys(item: object) -> list[str]:
    """Flatten nested Literal[...] keys used by pydantic on Python 3.9."""
    args = get_args(item)
    if not args:
        return [item] if isinstance(item, str) else []
    flattened: list[str] = []
    for child in args:
        flattened.extend(_flatten_core_schema_keys(child))
    return flattened


def _patch_pydantic_openapi_py39() -> None:
    """
    Work around pydantic/typing behavior on Python 3.9 where
    CoreSchemaOrFieldType can contain nested Literal objects.
    """
    keys = _flatten_core_schema_keys(CoreSchemaOrFieldType)
    if not keys:
        return

    def build_schema_type_to_method(self: GenerateJsonSchema) -> dict[str, object]:
        mapping: dict[str, object] = {}
        for key in keys:
            method_name = f"{key.replace('-', '_')}_schema"
            mapping[key] = getattr(self, method_name)
        return mapping

    GenerateJsonSchema.build_schema_type_to_method = build_schema_type_to_method


_patch_pydantic_openapi_py39()


def create_app(settings: Optional[Settings] = None) -> FastAPI:
    """Application factory (optional `settings` override is partial; prefer env for Phase 1)."""
    resolved = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        setup_logging(resolved)
        job_store = JobStore(resolved)
        whisper = WhisperTranscriptionService(resolved)
        screenshot_service = ScreenshotExtractionService(resolved)
        ocr_service = OCRService(resolved)
        pipeline = TranscriptionPipeline(
            resolved, job_store, whisper, screenshot_service, ocr_service
        )
        app.state.job_store = job_store
        app.state.whisper_service = whisper
        app.state.screenshot_service = screenshot_service
        app.state.ocr_service = ocr_service
        app.state.pipeline = pipeline
        yield

    app = FastAPI(title=resolved.app_name, lifespan=lifespan)
    app.include_router(v1_router, prefix="/api/v1")

    @app.get("/health", tags=["health"])
    def health() -> JSONResponse:
        return JSONResponse({"status": "ok"})

    return app


app = create_app()
