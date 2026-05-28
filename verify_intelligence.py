"""Verification script for Phase 8 Intelligence Services (Notes & Flashcards)."""

import asyncio
import sys
from pathlib import Path
from uuid import UUID
import json

# Add backend to path
sys.path.append(str(Path(__file__).parent / "backend"))

from app.services.intelligence.notes_service import NotesService
from app.services.intelligence.flashcard_service import FlashcardService
from app.services.llm.ollama_service import OllamaService
from app.services.storage.job_store import JobStore
from app.core.config import Settings
from app.schemas.intelligence import NotesMode, FlashcardType

async def test_intelligence_services():
    print("--- Testing Phase 8 Intelligence Services ---")
    
    # 1. Setup mock context
    settings = Settings()
    job_store = JobStore(settings)
    ollama = OllamaService(settings)
    
    notes_service = NotesService(settings, job_store, ollama)
    flashcard_service = FlashcardService(settings, job_store, ollama)
    
    # Use an existing job_id from local storage if available, 
    # or a mock one with dummy chunks.
    job_id = UUID("840b59b4-c8a0-4a36-aef0-d7a773e178b8")
    
    print(f"1. Testing Notes Generation for session {job_id}...")
    try:
        notes = await notes_service.generate_notes(job_id, NotesMode.STANDARD)
        print("\n--- GENERATED NOTES (Partial) ---")
        print(notes.content[:500] + "...")
        print(f"\nKey Concepts: {notes.key_concepts}")
        print("Notes Generation SUCCESS!")
    except Exception as e:
        print(f"Notes Generation FAILED: {e}")

    print(f"\n2. Testing Flashcard Generation for session {job_id}...")
    try:
        flashcards = await flashcard_service.generate_flashcards(job_id, count=3, card_type=FlashcardType.QA)
        print(f"\nGenerated {len(flashcards.flashcards)} flashcards:")
        for i, card in enumerate(flashcards.flashcards):
            print(f"  [{i+1}] Q: {card.question}")
            print(f"      A: {card.answer}")
        print("Flashcard Generation SUCCESS!")
    except Exception as e:
        print(f"Flashcard Generation FAILED: {e}")

if __name__ == "__main__":
    asyncio.run(test_intelligence_services())
