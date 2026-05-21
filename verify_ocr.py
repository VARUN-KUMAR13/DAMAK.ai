import sys
from pathlib import Path
from unittest.mock import MagicMock
import uuid
import json

# Add backend to path
sys.path.append(str(Path(__file__).parent / "backend"))

from app.services.ocr.ocr_service import OCRService
from app.core.config import Settings

def test_ocr_service_logic():
    print("Testing OCRService logic...")
    settings = Settings()
    # Mock settings
    settings.storage_screenshots = Path("test_storage/screenshots")
    settings.storage_ocr = Path("test_storage/ocr")
    
    # Create test dirs
    settings.storage_screenshots.mkdir(parents=True, exist_ok=True)
    settings.storage_ocr.mkdir(parents=True, exist_ok=True)
    
    job_id = uuid.uuid4()
    job_screenshot_dir = settings.storage_screenshots / str(job_id)
    job_screenshot_dir.mkdir(parents=True, exist_ok=True)
    
    # Create dummy screenshot
    screenshot_file = job_screenshot_dir / "frame_0001.jpg"
    screenshot_file.write_text("dummy image content")
    
    # Mock OCR engine
    ocr_service = OCRService(settings)
    mock_engine = MagicMock()
    # PaddleOCR.ocr returns: [[ [box, (text, confidence)], ... ]]
    mock_engine.ocr.return_value = [[
        [[[0,0], [1,0], [1,1], [0,1]], ("Test OCR Line 1", 0.99)],
        [[[0,2], [1,2], [1,3], [0,3]], ("Test OCR Line 2", 0.98)]
    ]]
    ocr_service._ocr = mock_engine
    
    metadata = [
        {"filename": "frame_0001.jpg", "timestamp": 1.0, "frame_index": 25}
    ]
    
    results = ocr_service.run_ocr(job_id, metadata)
    
    print(f"OCR Results: {results}")
    assert len(results) == 1
    assert "Test OCR Line 1\nTest OCR Line 2" in results[0]["text"]
    assert results[0]["filename"] == "frame_0001.jpg"
    
    # Verify file saved
    results_file = settings.storage_ocr / str(job_id) / "ocr_results.json"
    assert results_file.exists()
    saved_data = json.loads(results_file.read_text())
    assert len(saved_data) == 1
    assert saved_data[0]["text"] == results[0]["text"]
    
    print("OCRService logic test PASSED!")

if __name__ == "__main__":
    try:
        test_ocr_service_logic()
    except Exception as e:
        print(f"Test failed: {e}")
        sys.exit(1)
    finally:
        # Cleanup
        import shutil
        if Path("test_storage").exists():
            shutil.rmtree("test_storage")
