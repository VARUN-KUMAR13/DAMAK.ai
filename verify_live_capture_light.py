"""Lightweight verification script for Phase 7A: Live Session Capture."""

import asyncio
import sys
import os
import shutil
from pathlib import Path
from uuid import UUID
import json
from datetime import datetime

# Add backend to path
sys.path.append(str(Path(__file__).parent / "backend"))

# Mock JobStore and Settings to avoid heavy imports
from unittest.mock import MagicMock

class MockSettings:
    def __init__(self, root):
        self.storage_live = root / "storage" / "live"
        self.storage_uploads = root / "storage" / "uploads"
        self.storage_audio = root / "storage" / "audio"
        self.storage_transcripts = root / "storage" / "transcripts"
        self.storage_screenshots = root / "storage" / "screenshots"
        self.storage_ocr = root / "storage" / "ocr"
        self.storage_chunks = root / "storage" / "chunks"
        self.storage_embeddings = root / "storage" / "embeddings"
        self.screenshot_ssim_threshold = 0.96

from app.services.live.live_session_service import LiveSessionService
from app.services.storage.job_store import JobStore

async def test_live_capture_logic():
    print("--- Testing Phase 7A: Live Session Capture (Logic Only) ---")
    
    test_root = Path("test_storage_p7_light")
    if test_root.exists():
        shutil.rmtree(test_root)
    test_root.mkdir()
    
    settings = MockSettings(test_root)
    settings.storage_live.mkdir(parents=True, exist_ok=True)
    
    # We need a real JobStore but we'll mock its dependencies if needed
    job_store = JobStore(settings)
    live_service = LiveSessionService(settings, job_store)
    
    # 1. Start Session
    print("1. Starting session...")
    session = live_service.start_session("Test Lecture")
    session_id = session.session_id
    print(f"   Session ID: {session_id}")

    # 2. Upload Screenshots
    print("2. Uploading screenshots...")
    import cv2
    import numpy as np
    dummy_img = np.zeros((100, 100, 3), dtype=np.uint8)
    _, img_encoded = cv2.imencode('.jpg', dummy_img)
    img_bytes = img_encoded.tobytes()

    await live_service.add_screenshot(session_id, img_bytes, 1.0)
    await live_service.add_screenshot(session_id, img_bytes, 2.0) # Should be skipped (duplicate)
    
    # Different image (much more different)
    dummy_img[:, :] = 255
    _, img_encoded = cv2.imencode('.jpg', dummy_img)
    img_bytes = img_encoded.tobytes()
    await live_service.add_screenshot(session_id, img_bytes, 5.0)

    # 3. Upload Audio Chunks
    print("3. Uploading audio chunks...")
    await live_service.add_audio_chunk(session_id, b"chunk1")
    await live_service.add_audio_chunk(session_id, b"chunk2")

    # 4. Stop Session
    print("4. Stopping session...")
    detail = live_service.stop_session(session_id)
    print(f"   Status: {detail.status}")
    print(f"   Screenshot Count: {detail.screenshot_count}")

    # 5. Verify storage
    print("5. Verifying storage...")
    record = job_store.get(session_id)
    assert record is not None
    assert record.audio_path.exists()
    assert record.screenshots_metadata_path.exists()
    
    with open(record.screenshots_metadata_path, "r") as f:
        meta = json.load(f)
        assert len(meta) == 2
        print(f"   Meta count: {len(meta)} (Correct)")
        
    merged_audio_size = record.audio_path.stat().st_size
    assert merged_audio_size == len(b"chunk1") + len(b"chunk2")
    print(f"   Merged audio size: {merged_audio_size} bytes (Correct)")

    print("\nLive Capture logic test PASSED!")

if __name__ == "__main__":
    import shutil
    try:
        asyncio.run(test_live_capture_logic())
    finally:
        if Path("test_storage_p7_light").exists():
            shutil.rmtree("test_storage_p7_light")
