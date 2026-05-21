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
                    "lang": self._settings.ocr_lang,
                    "show_log": False
                }
                
                # Only add these if they are likely to be supported
                # Some versions/wrappers might not support them directly in constructor
                try:
                    self._ocr = PaddleOCR(
                        use_angle_cls=self._settings.ocr_use_angle_cls,
                        use_gpu=self._settings.ocr_use_gpu,
                        **kwargs
                    )
                except TypeError:
                    logger.warning("PaddleOCR doesn't support use_angle_cls or use_gpu in constructor, trying defaults")
                    self._ocr = PaddleOCR(**kwargs)
                    
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
        screenshot_dir = self._settings.storage_screenshots / str(job_id)
        ocr_out_dir = self._settings.storage_ocr / str(job_id)
        ocr_out_dir.mkdir(parents=True, exist_ok=True)
        
        results_path = ocr_out_dir / "ocr_results.json"
        
        logger.info("Starting OCR processing for job %s, %d screenshots", job_id, len(screenshots_metadata))
        
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

        for i, meta in enumerate(screenshots_metadata):
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
                # OCR processing
                # result is a list of [box, (text, confidence)]
                result = ocr_engine.ocr(str(img_path), cls=self._settings.ocr_use_angle_cls)
                
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
                logger.exception("OCR failed for screenshot %s: %s", filename, e)
                # We continue with other screenshots even if one fails
                continue

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
