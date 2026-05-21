"""Extract meaningful screenshots from video for downstream OCR/search."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from uuid import UUID

import cv2
import numpy as np
from skimage.metrics import structural_similarity

from app.core.config import Settings

logger = logging.getLogger(__name__)


class ScreenshotExtractionError(RuntimeError):
    """Raised when screenshot extraction fails."""


class ScreenshotExtractionService:
    """OpenCV + SSIM screenshot extractor."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def _is_near_empty(self, gray_frame: np.ndarray) -> bool:
        """Detect if a frame is mostly blank/solid color."""
        # Check standard deviation - low std dev means solid color
        std_dev = np.std(gray_frame)
        if std_dev < 10:  # Very low variance
            return True
        
        # Check if mostly white or mostly black
        mean_val = np.mean(gray_frame)
        if mean_val > 250 or mean_val < 5:
            return True
            
        return False

    def _get_content_score(self, gray_frame: np.ndarray) -> float:
        """
        Estimate 'intelligence' of a frame (slides, code, diagrams).
        Uses edge density as a proxy for structured content.
        """
        # Resize for faster processing
        small = cv2.resize(gray_frame, (640, 360), interpolation=cv2.INTER_AREA)
        
        # Canny edge detection
        edges = cv2.Canny(small, 50, 150)
        edge_density = np.count_nonzero(edges) / edges.size
        
        # Laplacian variance for sharpness/detail
        laplacian_var = cv2.Laplacian(small, cv2.CV_64F).var()
        
        # Heuristic score: higher edge density and variance usually means more text/diagrams
        # Normalize slightly to keep it in a reasonable range
        score = (edge_density * 100) + (laplacian_var / 100)
        return score

    def extract_sync(self, video_path: Path, job_id: UUID) -> list[dict[str, object]]:
        """
        Save scene/slide-change screenshots and write metadata JSON.

        Returns metadata list:
        [{"timestamp": 12.4, "frame_index": 372, "filename": "frame_0001.jpg"}, ...]
        """
        out_dir = self._settings.storage_screenshots / str(job_id)
        out_dir.mkdir(parents=True, exist_ok=True)
        metadata_path = out_dir / "metadata.json"

        capture = cv2.VideoCapture(str(video_path.resolve()))
        if not capture.isOpened():
            raise ScreenshotExtractionError(f"Could not open video file: {video_path}")

        try:
            fps = capture.get(cv2.CAP_PROP_FPS)
            if fps <= 0:
                fps = 25.0
                logger.warning(
                    "Could not determine FPS for %s, defaulting to %.1f", video_path, fps
                )

            interval_frames = max(1, int(round(self._settings.screenshot_interval_sec * fps)))
            logger.info(
                "Screenshot extraction started for job %s (fps=%.2f, interval_frames=%d, ssim_threshold=%.3f)",
                job_id,
                fps,
                interval_frames,
                self._settings.screenshot_ssim_threshold,
            )

            frame_idx = 0
            save_idx = 0
            entries: list[dict[str, object]] = []
            previous_gray_small = None

            while True:
                ok, frame = capture.read()
                if not ok:
                    break

                if frame_idx % interval_frames != 0:
                    frame_idx += 1
                    continue

                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                
                # Intelligence: skip near-empty frames
                if self._is_near_empty(gray):
                    frame_idx += 1
                    continue

                gray_small = cv2.resize(gray, (320, 180), interpolation=cv2.INTER_AREA)

                should_save = previous_gray_small is None
                if not should_save:
                    score = float(structural_similarity(previous_gray_small, gray_small))
                    visual_delta = 1.0 - score
                    
                    # Intelligence: only save if change is significant AND not a redundant slight shift
                    should_save = (
                        score < self._settings.screenshot_ssim_threshold
                        and visual_delta >= self._settings.screenshot_min_change_ratio
                    )
                
                if should_save:
                    # Intelligence: content score logging (could be used for filtering if needed)
                    content_score = self._get_content_score(gray)
                    logger.debug("Frame %d content score: %.2f", frame_idx, content_score)
                    
                    # Optional: skip if content score is extremely low (e.g., just a tiny bit of text)
                    if content_score < 1.0:
                        logger.debug("Skipping low-content frame %d", frame_idx)
                        frame_idx += 1
                        continue

                    save_idx += 1
                    filename = f"frame_{save_idx:04d}.jpg"
                    frame_path = out_dir / filename
                    ok_write = cv2.imwrite(
                        str(frame_path),
                        frame,
                        [int(cv2.IMWRITE_JPEG_QUALITY), self._settings.screenshot_jpeg_quality],
                    )
                    if not ok_write:
                        raise ScreenshotExtractionError(
                            f"Failed to write screenshot to {frame_path}"
                        )
                    entries.append(
                        {
                            "timestamp": round(frame_idx / fps, 3),
                            "frame_index": frame_idx,
                            "filename": filename,
                        }
                    )
                    previous_gray_small = gray_small

                frame_idx += 1

            metadata_path.write_text(
                json.dumps(entries, indent=2, ensure_ascii=False),
                encoding="utf-8",
            )
            logger.info(
                "Screenshot extraction completed for job %s: %d screenshots -> %s",
                job_id,
                len(entries),
                metadata_path,
            )
            return entries
        except Exception as e:  # noqa: BLE001
            raise ScreenshotExtractionError(str(e)) from e
        finally:
            capture.release()
