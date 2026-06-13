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


def build_rag_prompt(question: str, retrieved_chunks: List[SearchResultChunk], mode: str = "Standard") -> str:
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

    instructions = {
        "Standard": "Act as a university professor. Provide a balanced, comprehensive, and well-structured explanation using clear paragraphs. Maintain an academic but accessible tone.",
        "Concise": "Act as an executive summarizer. Answer using EXACTLY 3-4 bullet points. Provide only the most critical information with absolutely no fluff or introductory text.",
        "Detailed": "Act as a textbook author writing a deep-dive chapter. Break down the concept fundamentally. Include foundational principles, step-by-step mechanisms, real-world examples, and logical reasoning.",
        "Beginner Friendly": "Act as an empathetic middle-school teacher. Assume the user has zero prior knowledge. Use extremely simple language and rely heavily on everyday analogies (e.g., cars, water pipes, baking) to explain complex ideas. Avoid all technical jargon unless you immediately explain it.",
        "Exam Preparation": "Act as a strict exam grader. Structure your answer to maximize points: start with a crisp formal definition, list 3-4 critical bullet points, highlight 'Common Mistakes/Pitfalls', and end with a 'Likely Exam Question' based on the material.",
        "Quick Summary": "Act as a concise technical dictionary. Define the answer in a maximum of 2 to 3 short sentences. Get straight to the point.",
        "Interactive Tutor": "Act as a Socratic tutor. DO NOT give the direct or complete answer immediately. Instead, provide a small hint or foundational piece of knowledge, then ask the user a guiding question to help them figure out the rest of the answer themselves. Encourage critical thinking."
    }

    mode_instruction = instructions.get(mode, instructions["Standard"])

    prompt = (
        "You are an intelligent, engaging AI learning tutor.\n"
        f"Mode: {mode}\n"
        f"Persona Instruction: {mode_instruction}\n\n"
        "You MUST adhere strictly to the persona instruction above. Your tone, structure, and length must reflect this mode perfectly.\n\n"
        "Answer ONLY using the provided lecture context. If the answer is not present in the context, clearly say:\n"
        "\"I could not find that information in the lecture.\"\n\n"
        "Lecture Context:\n"
        f"{context_str}\n\n"
        "User Question:\n"
        f"{question}\n\n"
        "Tutor Response:"
    )
    return prompt
