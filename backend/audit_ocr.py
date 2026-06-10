import asyncio
import logging
from uuid import uuid4
from pathlib import Path
from app.core.config import get_settings
from app.services.ocr.ocr_service import OCRService
from app.services.media.screenshot_extract import ScreenshotExtractionService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def main():
    settings = get_settings()
    job_id = uuid4()
    
    # 1. Use existing test video
    video_path = Path("d:/DAMAK AI/input.mp4")
    if not video_path.exists():
        logger.error(f"Test video {video_path} not found.")
        return
        
    logger.info(f"Using test video: {video_path}")
    
    # 2. Extract Screenshots
    screenshot_service = ScreenshotExtractionService(settings)
    logger.info("Extracting screenshots...")
    metadata = screenshot_service.extract_sync(video_path, job_id)
    logger.info(f"Extracted {len(metadata)} screenshots.")
    
    # 3. Run OCR
    ocr_service = OCRService(settings)
    logger.info("Running OCR...")
    ocr_results = ocr_service.run_ocr(job_id, metadata)
    logger.info(f"OCR completed. {len(ocr_results)} results.")

if __name__ == "__main__":
    asyncio.run(main())
