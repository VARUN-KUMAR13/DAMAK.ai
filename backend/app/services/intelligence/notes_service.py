"""Service for generating AI notes from lecture chunks."""

from __future__ import annotations

import logging
from typing import List, Optional
from uuid import UUID

from app.core.config import Settings
from app.schemas.intelligence import NotesMode, NotesResponse
from app.schemas.chunk import MultimodalChunk
from app.services.llm.ollama_service import OllamaService
from app.services.storage.job_store import JobStore

logger = logging.getLogger(__name__)


from app.services.live.meeting_store import MeetingStore

class NotesService:
    """Generates structured markdown notes from semantic chunks."""

    def __init__(self, settings: Settings, job_store: JobStore, ollama: OllamaService, meeting_store: Optional[MeetingStore] = None) -> None:
        self._settings = settings
        self._job_store = job_store
        self._ollama = ollama
        self._meeting_store = meeting_store

    async def generate_notes(self, session_id: UUID, mode: NotesMode) -> NotesResponse:
        """
        Generate notes for a session using semantic chunks.
        """
        logger.info("Generating %s notes for session %s", mode, session_id)
        
        # 1. Load chunks
        chunks_data = self._job_store.load_chunks(session_id)
        
        if not chunks_data and getattr(self, "_meeting_store", None):
            meeting = self._meeting_store.get_meeting(str(session_id))
            if meeting and "chunks" in meeting:
                chunks_data = [
                    {
                        "start_time": c.get("start_time", 0.0),
                        "spoken_text": c.get("text", ""),
                        "slide_text": None
                    } for c in meeting["chunks"]
                ]

        if not chunks_data:
            return NotesResponse(
                session_id=session_id,
                title="Empty Session",
                mode=mode,
                content="> ⚠️ **Cannot generate notes: No audio or text captured for this session.**\n\nMake sure your microphone/tab audio was recorded and that the processing pipeline has finished running.",
                key_concepts=[],
                citations=[]
            )

        # 2. Prepare context from chunks
        # Chunk sampling strategy to avoid overwhelming the LLM
        max_chunks = 30
        if len(chunks_data) > max_chunks:
            step = len(chunks_data) / max_chunks
            sampled_chunks = [chunks_data[int(i * step)] for i in range(max_chunks)]
        else:
            sampled_chunks = chunks_data

        job_rec = self._job_store.get(session_id)
        
        context_parts = []
        seen_screenshots = set()
        for i, c in enumerate(sampled_chunks):
            part = f"--- Chunk {i+1} ---\n"
            if c.get('slide_text'):
                part += f"Slide Text: {c.get('slide_text')}\n"
            
            # Intelligent Screenshot Integration
            screenshots = c.get('screenshots', [])
            if screenshots and job_rec and job_rec.screenshots_dir:
                for s in screenshots:
                    if s not in seen_screenshots:
                        seen_screenshots.add(s)
                        img_path = job_rec.screenshots_dir / s
                        if img_path.exists():
                            part += f"Available Image: [IMAGE_AVAILABLE: {s}]\n"
                        break # Limit to 1 new image per chunk
                        
            part += f"Speech: {c.get('spoken_text')}\n"
            context_parts.append(part)
        
        context_text = "\n".join(context_parts)

        # 3. Build prompt based on mode
        prompt = self._build_notes_prompt(context_text, mode)

        # 4. Generate via Ollama
        try:
            raw_response = await self._ollama.generate_response(prompt, json_format=True)
            
            text = raw_response.strip()
            if text.startswith("```json"):
                text = text.split("```json", 1)[1]
                if text.endswith("```"):
                    text = text.rsplit("```", 1)[0]
                text = text.strip()
            elif text.startswith("```"):
                text = text.split("```", 1)[1]
                if text.endswith("```"):
                    text = text.rsplit("```", 1)[0]
                text = text.strip()
                
            try:
                import json
                import re
                data = json.loads(text)
                content = data.get("content", "No notes generated.")
                
                # Replace image placeholders with actual valid URLs
                def replace_img_url(match):
                    caption = match.group(1)
                    filename = match.group(2).strip()
                    return f"![{caption}](/api/v1/jobs/{session_id}/screenshots/{filename})"
                
                content = re.sub(r'!\[([^\]]*)\]\(\[IMAGE_AVAILABLE:\s*(.+?)\]\)', replace_img_url, content)
                content = re.sub(r'\[IMAGE_AVAILABLE:\s*(.+?)\]', '', content)
                
                key_concepts = data.get("key_concepts", [])
                citations = data.get("citations", [])
            except Exception as e:
                logger.error("Failed to parse notes LLM response: %s. Raw response: %s", e, raw_response, exc_info=True)
                # Fallback if LLM fails to return valid JSON
                content = "Notes generation succeeded but the AI response could not be formatted properly. Please try regenerating."
                if "{" in text and '"content"' in text:
                    # Attempt manual extraction
                    try:
                        extracted = text.split('"content": "')[1].split('",\n')[0]
                        content = extracted.replace('\\n', '\n').replace('\\"', '"')
                        content = re.sub(r'!\[([^\]]*)\]\(\[IMAGE_AVAILABLE:\s*(.+?)\]\)', replace_img_url, content)
                        content = re.sub(r'\[IMAGE_AVAILABLE:\s*(.+?)\]', '', content)
                    except:
                        pass
                key_concepts = []
                citations = []
            
        except Exception as e:
            logger.error("Failed to generate notes via Ollama: %s", e, exc_info=True)
            raise RuntimeError(f"Notes generation failed: {e}") from e

        # Get title from job store
        job_rec = self._job_store.get(session_id)
        title = job_rec.source_filename if job_rec else "Untitled Session"

        return NotesResponse(
            session_id=session_id,
            title=title,
            mode=mode,
            content=content,
            key_concepts=key_concepts,
            citations=citations
        )

    def _build_notes_prompt(self, context: str, mode: NotesMode) -> str:
        instructions = {
            NotesMode.EASY: "Create simple, high-level summary notes with clear bullet points. Explain complex terms simply.",
            NotesMode.STANDARD: "Create structured academic notes with sections, key concepts, and detailed explanations.",
            NotesMode.DEEP: "Create comprehensive, in-depth technical notes. Include all details, formulas, and deep logic mentioned.",
            NotesMode.AS_IS: "Transcribe the lecture into a clean, readable document preserving the original flow.",
            NotesMode.EXAM: "Focus on potential exam questions, key definitions, and critical takeaways. Use a 'cheat sheet' style."
        }

        prompt = (
            "You are an expert academic note-taker.\n"
            f"Mode: {mode.value.upper()}\n"
            f"Instruction: {instructions.get(mode, instructions[NotesMode.STANDARD])}\n\n"
            "You MUST generate notes using EXACTLY the following structure as Markdown headers:\n"
            "## Executive Summary\n"
            "## Key Concepts\n"
            "## Detailed Notes\n"
            "## Examples\n"
            "## Important Takeaways\n"
            "## Revision Points\n\n"
            "CRITICAL INSTRUCTIONS:\n"
            "- Do NOT include any visible timestamps (like [Time: 0.0s]) in the 'content' string.\n"
            "- If you encounter complex technical or medical terms, add a clearly labeled '> 💡 **Knowledge Enrichment:**' blockquote defining them ON A NEW LINE.\n"
            "- If an 'Available Image' (e.g., [IMAGE_AVAILABLE: slide_1.jpg]) is provided in the context, you MUST embed it exactly into the relevant section of the Detailed Notes using a markdown image tag with a descriptive caption (e.g. `![Diagram showing the anatomy of the heart]([IMAGE_AVAILABLE: slide_1.jpg])`). Do NOT include the raw placeholder outside of an image tag.\n\n"
            "You MUST return your response ONLY as a valid JSON object with the following properties:\n"
            "- \"content\": A string containing the full markdown notes.\n"
            "- \"key_concepts\": An array of up to 10 strings, each representing a core concept.\n"
            "- \"citations\": An array of objects. Each object must have \"timestamp\" (number in seconds), and \"text\" (string summarizing the source).\n\n"
            "Lecture Context:\n"
            f"{context}\n\n"
            "Respond ONLY with the raw JSON object. Do not include markdown blocks outside the JSON."
        )
        return prompt
