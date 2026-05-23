"""Multimodal chunking service to align OCR and speech."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from uuid import UUID
from typing import Any, List, Optional

from app.core.config import Settings
from app.schemas.chunk import MultimodalChunk, ChunkPayload
from app.schemas.transcript import TranscriptPayload

logger = logging.getLogger(__name__)


class ChunkingError(RuntimeError):
    """Raised when chunk generation fails."""


class ChunkService:
    """Service for generating multimodal semantic chunks."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def generate_chunks(
        self, 
        job_id: UUID, 
        transcript: TranscriptPayload, 
        ocr_results: List[dict[str, Any]]
    ) -> List[MultimodalChunk]:
        """
        Align OCR slides with Whisper transcript to create semantic chunks.
        """
        logger.info("Starting multimodal chunking for job %s", job_id)
        
        chunks: List[MultimodalChunk] = []
        segments = transcript.segments
        
        if not segments:
            logger.warning("No transcription segments found for job %s", job_id)
            return []

        # Current chunk state
        current_spoken_texts = []
        current_start = segments[0].start
        current_word_count = 0
        chunk_idx = 1

        for i, seg in enumerate(segments):
            words = seg.text.split()
            current_spoken_texts.append(seg.text)
            current_word_count += len(words)
            
            # Check if we should close this chunk
            is_last = i == len(segments) - 1
            reached_max = current_word_count >= self._settings.chunk_max_words
            
            if reached_max or is_last:
                end_time = seg.end
                spoken_text = " ".join(current_spoken_texts).strip()
                
                # Find overlapping OCR results
                overlapping_ocr = [
                    res for res in ocr_results 
                    if res.get("timestamp", 0) >= current_start - self._settings.chunk_overlap_sec
                    and res.get("timestamp", 0) <= end_time + self._settings.chunk_overlap_sec
                ]
                
                # Extract slide text and screenshots
                slide_texts = []
                screenshots = []
                seen_texts = set()
                
                for ocr in overlapping_ocr:
                    text = ocr.get("text", "").strip()
                    if text and text not in seen_texts:
                        slide_texts.append(text)
                        seen_texts.add(text)
                    
                    fname = ocr.get("filename")
                    if fname:
                        screenshots.append(fname)

                combined_slide_text = "\n".join(slide_texts).strip() if slide_texts else None
                
                # Prepare combined text for RAG/LLM
                combined_content = f"Slide Content:\n{combined_slide_text}\n\nSpoken Content:\n{spoken_text}" if combined_slide_text else spoken_text

                chunks.append(MultimodalChunk(
                    chunk_id=f"chunk_{chunk_idx:03d}",
                    start_time=round(current_start, 2),
                    end_time=round(end_time, 2),
                    slide_text=combined_slide_text,
                    spoken_text=spoken_text,
                    combined_text=combined_content,
                    screenshots=list(dict.fromkeys(screenshots)) # deduplicate
                ))
                
                # Reset for next chunk
                chunk_idx += 1
                current_spoken_texts = []
                current_word_count = 0
                if not is_last:
                    current_start = segments[i+1].start

        # Save to disk
        self._save_chunks(job_id, chunks)
        
        logger.info("Generated %d multimodal chunks for job %s", len(chunks), job_id)
        return chunks

    def _save_chunks(self, job_id: UUID, chunks: List[MultimodalChunk]) -> Path:
        out_dir = self._settings.storage_chunks / str(job_id)
        out_dir.mkdir(parents=True, exist_ok=True)
        results_path = out_dir / "chunks.json"
        
        payload = ChunkPayload(
            job_id=str(job_id),
            chunks=chunks,
            total_chunks=len(chunks)
        )
        
        try:
            results_path.write_text(
                payload.model_dump_json(indent=2),
                encoding="utf-8"
            )
            return results_path
        except Exception as e:
            logger.error("Failed to save chunks for job %s: %s", job_id, e)
            raise ChunkingError(f"Failed to save chunks: {e}") from e
