"""OCR processing pipeline using PaddleOCR."""

from __future__ import annotations

import json
import logging
import hashlib
from pathlib import Path
from uuid import UUID
from typing import Any

from paddleocr import PaddleOCR
from app.core.config import Settings
import cv2
import numpy as np

logger = logging.getLogger(__name__)


class OCRError(RuntimeError):
    """Raised when OCR processing fails."""


class OCRService:
    """Service for extracting text from screenshots using PaddleOCR."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._ocr: PaddleOCR | None = None

    def _get_ocr_engine(self) -> PaddleOCR:
        """Lazy initialization of PaddleOCR engine."""
        if self._ocr is None:
            try:
                logger.info("Initializing PaddleOCR engine (lang=%s)", self._settings.ocr_lang)
                # Use a more robust initialization
                kwargs = {
                    "lang": self._settings.ocr_lang
                }
                
                self._ocr = PaddleOCR(
                    lang=self._settings.ocr_lang
                )
                    
            except Exception as e:
                logger.error("Failed to initialize PaddleOCR: %s", e)
                raise OCRError(f"PaddleOCR initialization failed: {e}") from e
        return self._ocr

    def _get_file_hash(self, file_path: Path) -> str:
        """Calculate SHA-256 hash of a file to detect duplicates."""
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()

    def run_ocr(self, job_id: UUID, screenshots_metadata: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """
        Process extracted screenshots and save OCR results.
        
        screenshots_metadata: List of dicts with 'filename', 'timestamp', 'frame_index'
        """
        def _crop_letterbox(img_path: Path) -> None:
            """Crops black/white letterboxing from an image and overwrites it."""
            try:
                img = cv2.imread(str(img_path))
                if img is None:
                    return
                
                # Convert to grayscale
                gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                
                # Create a mask for non-black pixels (to crop black letterboxing)
                _, thresh = cv2.threshold(gray, 15, 255, cv2.THRESH_BINARY)
                
                # Find contours
                contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                
                if contours:
                    # Find the bounding box that encompasses all significant non-black regions
                    x_min, y_min = img.shape[1], img.shape[0]
                    x_max, y_max = 0, 0
                    
                    found_valid = False
                    for c in contours:
                        x, y, w, h = cv2.boundingRect(c)
                        # Filter out very small noise (e.g. less than 20x20 pixels)
                        if w > 20 and h > 20:
                            x_min = min(x_min, x)
                            y_min = min(y_min, y)
                            x_max = max(x_max, x + w)
                            y_max = max(y_max, y + h)
                            found_valid = True
                    
                    if found_valid and (x_max > x_min) and (y_max > y_min):
                        # Add a small padding (e.g., 5 pixels) to not cut off text
                        pad = 5
                        y_start = max(0, y_min - pad)
                        y_end = min(img.shape[0], y_max + pad)
                        x_start = max(0, x_min - pad)
                        x_end = min(img.shape[1], x_max + pad)
                        
                        cropped = img[y_start:y_end, x_start:x_end]
                        # Only overwrite if we actually cropped something significant
                        if cropped.shape[0] < img.shape[0] - 10 or cropped.shape[1] < img.shape[1] - 10:
                            cv2.imwrite(str(img_path), cropped)
                            logger.debug("Cropped letterboxing for %s", img_path.name)
            except Exception as e:
                logger.warning(f"Failed to crop letterboxing for {img_path}: {e}")

        screenshot_dir = self._settings.storage_screenshots / str(job_id)
        ocr_out_dir = self._settings.storage_ocr / str(job_id)
        ocr_out_dir.mkdir(parents=True, exist_ok=True)
        
        results_path = ocr_out_dir / "ocr_results.json"
        
        logger.info("Starting OCR processing for job %s, %d screenshots", job_id, len(screenshots_metadata))
        
        # Intelligence: Skip PaddleOCR initialization if there are no screenshots to process
        if not screenshots_metadata:
            logger.info("Job %s: No screenshots to process, skipping OCR", job_id)
            results_path.write_text("[]", encoding="utf-8")
            return []
            
        ocr_engine = self._get_ocr_engine()
        ocr_results: list[dict[str, Any]] = []
        processed_hashes: dict[str, str] = {} # hash -> first_filename

        stats = {
            "total": len(screenshots_metadata),
            "processed": 0,
            "skipped_duplicate": 0,
            "skipped_missing": 0,
            "valid_text": 0,
            "empty_output": 0,
            "errors": 0
        }

        import time
        frame_times = []

        # Optional: Hard limit on frames to prevent runaway processing
        MAX_FRAMES = self._settings.__dict__.get("screenshot_max_ocr_frames", 50)
        
        for i, meta in enumerate(screenshots_metadata):
            if stats["processed"] >= MAX_FRAMES:
                logger.warning(f"Reached max OCR frames limit ({MAX_FRAMES}). Skipping remaining.")
                break
                
            filename = meta["filename"]
            img_path = screenshot_dir / filename
            
            if not img_path.exists():
                logger.warning("Screenshot %s not found, skipping OCR", img_path)
                stats["skipped_missing"] += 1
                continue
                
            # Check for duplicates
            try:
                img_hash = self._get_file_hash(img_path)
                if img_hash in processed_hashes:
                    logger.debug("Skipping duplicate screenshot: %s (duplicate of %s)", 
                                 filename, processed_hashes[img_hash])
                    stats["skipped_duplicate"] += 1
                    continue
                processed_hashes[img_hash] = filename
            except Exception as e:
                logger.warning("Failed to calculate hash for %s: %s", filename, e)

            try:
                stats["processed"] += 1
                t_frame_start = time.perf_counter()
                
                # Crop letterboxing before OCR
                _crop_letterbox(img_path)
                
                # OCR processing
                # result is a list of [box, (text, confidence)]
                result = ocr_engine.ocr(str(img_path))
                
                t_frame_end = time.perf_counter()
                frame_times.append(t_frame_end - t_frame_start)
                
                # Debug logging for the first 3 screenshots
                if stats["processed"] <= 3:
                    logger.info("DEBUG: Raw OCR output for %s: %s", filename, result)
                
                # Extract text and preserve multiline format
                lines = []
                if result:
                    # PaddleOCR returns a list of results (one per page/image)
                    for res in result:
                        if res is None:
                            continue
                        for line in res:
                            # line structure: [ [box], (text, confidence) ]
                            if len(line) >= 2 and isinstance(line[1], (list, tuple)) and len(line[1]) >= 1:
                                text = str(line[1][0]).strip()
                                if text:
                                    lines.append(text)
                
                if lines:
                    full_text = "\n".join(lines)
                    ocr_results.append({
                        "timestamp": meta.get("timestamp"),
                        "filename": filename,
                        "frame_index": meta.get("frame_index"),
                        "text": full_text
                    })
                    stats["valid_text"] += 1
                    logger.debug("OCR extracted %d lines from %s", len(lines), filename)
                else:
                    stats["empty_output"] += 1
                    logger.info("OCR returned no text for %s", filename)
                
            except Exception as e:
                stats["errors"] += 1
                logger.warning("OCR failed for screenshot %s: %s", filename, e, exc_info=True)
                # We continue with other screenshots even if one fails
                continue

        if frame_times:
            avg_time = sum(frame_times) / len(frame_times)
            stats["avg_time_per_image_sec"] = round(avg_time, 3)
            stats["total_ocr_duration_sec"] = round(sum(frame_times), 3)

        # Save results
        try:
            results_path.write_text(
                json.dumps(ocr_results, indent=2, ensure_ascii=False),
                encoding="utf-8"
            )
            logger.info("OCR completed for job %s. Stats: %s", job_id, stats)
            logger.info("OCR results saved to %s", results_path)
        except Exception as e:
            logger.error("Failed to save OCR results for job %s: %s", job_id, e)
            raise OCRError(f"Failed to save OCR results: {e}") from e

        return ocr_results
