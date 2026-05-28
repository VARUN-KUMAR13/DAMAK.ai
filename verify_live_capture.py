"""Verification script for Phase 7A: Live Session Capture."""

import asyncio
import sys
import os
os.environ["PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION"] = "python"
import shutil
from pathlib import Path
from uuid import UUID
import time
import json

# Add backend to path
sys.path.append(str(Path(__file__).parent / "backend"))

from app.services.live.live_session_service import LiveSessionService
from app.services.storage.job_store import JobStore
from app.core.config import Settings
from app.services.pipeline.transcription_pipeline import TranscriptionPipeline
from app.services.transcription.whisper_service import WhisperTranscriptionService
from app.services.media.screenshot_extract import ScreenshotExtractionService
from app.services.ocr.ocr_service import OCRService
from app.services.pipeline.chunk_service import ChunkService
from app.services.embeddings.embedding_service import EmbeddingService
from app.services.llm.ollama_service import OllamaService

async def test_live_capture():
    print("--- Testing Phase 7A: Live Session Capture ---")
    
    # 1. Setup
    test_root = Path("test_storage_p7")
    if test_root.exists():
        shutil.rmtree(test_root)
    test_root.mkdir()
    
    settings = Settings()
    settings.project_root = test_root
    settings.storage_uploads = test_root / "storage" / "uploads"
    settings.storage_audio = test_root / "storage" / "audio"
    settings.storage_transcripts = test_root / "storage" / "transcripts"
    settings.storage_screenshots = test_root / "storage" / "screenshots"
    settings.storage_ocr = test_root / "storage" / "ocr"
    settings.storage_chunks = test_root / "storage" / "chunks"
    settings.storage_embeddings = test_root / "storage" / "embeddings"
    settings.storage_live = test_root / "storage" / "live"
    settings.chroma_db_dir = settings.storage_embeddings / "chroma_db"
    
    for p in [settings.storage_uploads, settings.storage_audio, settings.storage_transcripts, 
              settings.storage_screenshots, settings.storage_ocr, settings.storage_chunks, 
              settings.storage_embeddings, settings.storage_live]:
        p.mkdir(parents=True, exist_ok=True)

    job_store = JobStore(settings)
    live_service = LiveSessionService(settings, job_store)
    
    # Mock other services for pipeline
    whisper = WhisperTranscriptionService(settings)
    screenshot_service = ScreenshotExtractionService(settings)
    ocr_service = OCRService(settings)
    chunk_service = ChunkService(settings)
    embedding_service = EmbeddingService(settings)
    ollama_service = OllamaService(settings)
    
    pipeline = TranscriptionPipeline(
        settings, job_store, whisper, screenshot_service, ocr_service, chunk_service, embedding_service
    )

    # 2. Start Session
    print("1. Starting session...")
    session = live_service.start_session("Test Lecture")
    session_id = session.session_id
    print(f"   Session ID: {session_id}")

    # 3. Upload Screenshots
    print("2. Uploading screenshots...")
    # Create a dummy image
    import cv2
    import numpy as np
    dummy_img = np.zeros((100, 100, 3), dtype=np.uint8)
    _, img_encoded = cv2.imencode('.jpg', dummy_img)
    img_bytes = img_encoded.tobytes()

    await live_service.add_screenshot(session_id, img_bytes, 1.0)
    await live_service.add_screenshot(session_id, img_bytes, 2.0) # Should be skipped (duplicate)
    
    # Different image
    dummy_img[0, 0] = 255
    _, img_encoded = cv2.imencode('.jpg', dummy_img)
    img_bytes = img_encoded.tobytes()
    await live_service.add_screenshot(session_id, img_bytes, 5.0)

    # 4. Upload Audio Chunks
    print("3. Uploading audio chunks...")
    await live_service.add_audio_chunk(session_id, b"chunk1")
    await live_service.add_audio_chunk(session_id, b"chunk2")

    # 5. Stop Session
    print("4. Stopping session...")
    detail = live_service.stop_session(session_id)
    print(f"   Status: {detail.status}")
    print(f"   Screenshot Count: {detail.screenshot_count}")

    # 6. Verify Pipeline Readiness
    print("5. Verifying job record...")
    record = job_store.get(session_id)
    assert record is not None
    assert record.audio_path.exists()
    assert record.screenshots_metadata_path.exists()
    
    with open(record.screenshots_metadata_path, "r") as f:
        meta = json.load(f)
        assert len(meta) == 2 # One was skipped
        print(f"   Meta count: {len(meta)} (Correct)")

    print("\nLive Capture logic test PASSED!")

if __name__ == "__main__":
    import shutil
    try:
        asyncio.run(test_live_capture())
    finally:
        if Path("test_storage_p7").exists():
            shutil.rmtree("test_storage_p7")
