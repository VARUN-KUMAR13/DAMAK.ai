"""Verification script for Phase 6: Local RAG Chat with Ollama."""

import asyncio
import sys
from pathlib import Path
from uuid import uuid4

# Add backend to path
sys.path.append(str(Path(__file__).parent / "backend"))

from app.services.llm.ollama_service import OllamaService, build_rag_prompt
from app.services.embeddings.embedding_service import EmbeddingService
from app.core.config import Settings
from app.schemas.chunk import MultimodalChunk

async def test_rag_chat():
    print("--- Testing Phase 6: Local RAG Chat ---")
    
    settings = Settings()
    # Ensure test storage doesn't interfere with real data
    settings.storage_embeddings = Path("test_storage_p6/embeddings")
    settings.chroma_db_dir = settings.storage_embeddings / "chroma_db"
    settings.storage_embeddings.mkdir(parents=True, exist_ok=True)

    embedding_service = EmbeddingService(settings)
    ollama_service = OllamaService(settings)
    job_id = uuid4()
    
    # 1. Setup mock data
    print("1. Creating mock lecture data...")
    chunks = [
        MultimodalChunk(
            chunk_id="chunk_001",
            start_time=0.0,
            end_time=30.0,
            slide_text="The 2 Minute Rule",
            spoken_text="The 2 minute rule states that if a task takes less than two minutes, you should do it immediately. This prevents small tasks from piling up.",
            combined_text="Slide: The 2 Minute Rule\nSpeech: The 2 minute rule states that if a task takes less than two minutes, you should do it immediately.",
            screenshots=["frame_001.jpg"]
        ),
        MultimodalChunk(
            chunk_id="chunk_002",
            start_time=30.0,
            end_time=60.0,
            slide_text="Overcoming Procrastination",
            spoken_text="One way to stop procrastination is the 5-minute rule. Just start the task for 5 minutes, and usually you'll keep going.",
            combined_text="Slide: Overcoming Procrastination\nSpeech: One way to stop procrastination is the 5-minute rule.",
            screenshots=["frame_002.jpg"]
        )
    ]
    
    print("2. Indexing mock data into ChromaDB...")
    embedding_service.index_chunks(job_id, chunks)
    
    # 2. Test RAG flow
    question = "Explain the 2 minute rule based on the lecture."
    print(f"\n3. Testing RAG flow for question: '{question}'")
    
    print("   a. Retrieving context...")
    retrieved = embedding_service.search_similar_chunks(question, limit=1)
    if not retrieved:
        print("   FAILED: No context retrieved.")
        return

    print(f"   b. Building RAG prompt (Retrieved Chunk: {retrieved[0].chunk_id})...")
    prompt = build_rag_prompt(question, retrieved)
    print("--- PROMPT START ---")
    print(prompt)
    print("--- PROMPT END ---")
    
    print("\n4. Sending to Ollama (Ollama must be running and have 'phi3' pulled)...")
    try:
        answer = await ollama_service.generate_response(prompt)
        print("\n--- AI RESPONSE ---")
        print(answer)
        print("-------------------")
        
        if "two minutes" in answer.lower() or "immediately" in answer.lower():
            print("\nSUCCESS: AI provided a correct answer based on context!")
        else:
            print("\nWARNING: AI response might not be accurate. Check context alignment.")
            
    except Exception as e:
        print(f"\nFAILED: Could not connect to Ollama: {e}")
        print("Make sure Ollama is installed and running (`ollama serve`) and 'phi3' is pulled (`ollama pull phi3`).")

if __name__ == "__main__":
    import shutil
    try:
        asyncio.run(test_rag_chat())
    finally:
        if Path("test_storage_p6").exists():
            shutil.rmtree("test_storage_p6")
