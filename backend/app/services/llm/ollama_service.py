"""Local LLM service using Ollama."""

from __future__ import annotations

import json
import logging
import httpx
from typing import List, Any

from app.core.config import Settings
from app.schemas.search import SearchResultChunk

logger = logging.getLogger(__name__)


class OllamaError(RuntimeError):
    """Raised when Ollama generation fails."""


class OllamaService:
    """Service for interacting with local Ollama instance."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._base_url = self._settings.ollama_base_url
        self._model = self._settings.ollama_model

    async def generate_response(self, prompt: str, json_format: bool = False) -> str:
        """
        Send prompt to Ollama and return generated text.
        """
        url = f"{self._base_url}/api/generate"
        payload = {
            "model": self._model,
            "prompt": prompt,
            "stream": False
        }
        if json_format:
            payload["format"] = "json"
        logger.info(f"Ollama URL: {url}")
        logger.info(f"Ollama model: {self._model}")

        logger.info("Sending RAG prompt to Ollama (model=%s)", self._model)
        
        try:
            async with httpx.AsyncClient(timeout=300.0) as client:
                response = await client.post(url, json=payload)
                
                logger.info(f"Ollama status code: {response.status_code}")
                logger.info(f"Ollama raw response: {response.text}")

                response.raise_for_status()

                data = response.json()

                generated_text = data.get("response", "").strip()

                if not generated_text:
                    logger.error("Ollama returned empty response")
                    raise OllamaError("Ollama returned empty response")
                
                return generated_text
                
        except httpx.HTTPStatusError as e:
            logger.error("Ollama HTTP error: %s - %s", e.response.status_code, e.response.text)
            raise OllamaError(f"Ollama returned error: {e.response.status_code}") from e
        except Exception as e:
            logger.error("Ollama connection failed: %s", e)
            raise OllamaError(f"Ollama connection failed: {e}") from e


def build_rag_prompt(question: str, retrieved_chunks: List[SearchResultChunk]) -> str:
    """
    Construct a structured RAG prompt for the LLM.
    """
    context_parts = []
    for i, chunk in enumerate(retrieved_chunks):
        part = (
            f"--- Context Segment {i+1} ---\n"
            f"Time: {chunk.start_time:.1f}s - {chunk.end_time:.1f}s\n"
        )
        if chunk.slide_text:
            part += f"Slide Text: {chunk.slide_text}\n"
        part += f"Spoken Text: {chunk.spoken_text}\n"
        context_parts.append(part)

    context_str = "\n".join(context_parts)

    prompt = (
        "You are an AI lecture tutor.\n"
        "Answer ONLY using the provided lecture context.\n"
        "If the answer is not present in the context, clearly say:\n"
        "\"I could not find that information in the lecture.\"\n\n"
        "Lecture Context:\n"
        f"{context_str}\n\n"
        "Question:\n"
        f"{question}\n\n"
        "Answer:"
    )
    return prompt
