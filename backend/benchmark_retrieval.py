import asyncio
import time
import logging
from unittest.mock import patch
import uuid

from app.core.config import get_settings
from app.services.embeddings.embedding_service import EmbeddingService
from app.schemas.chunk import MultimodalChunk

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def run_benchmark():
    settings = get_settings()
    embedder = EmbeddingService(settings)
    
    logger.info("--- PHASE 9D RETRIEVAL BENCHMARK ---")
    
    job_id = uuid.uuid4()
    
    # 1. Mocking chunks into Chroma
    mock_chunks = [
        MultimodalChunk(chunk_id="c1", start_time=0, end_time=10, spoken_text="Welcome to machine learning.", combined_text="Welcome to machine learning.", screenshots=[]),
        MultimodalChunk(chunk_id="c2", start_time=10, end_time=20, spoken_text="Deep neural networks use backpropagation.", combined_text="Deep neural networks use backpropagation.", screenshots=[]),
        MultimodalChunk(chunk_id="c3", start_time=20, end_time=30, spoken_text="Spaced repetition algorithms like SM-2.", combined_text="Spaced repetition algorithms like SM-2.", screenshots=[]),
        MultimodalChunk(chunk_id="c4", start_time=30, end_time=40, spoken_text="Apples and bananas are fruits.", combined_text="Apples and bananas are fruits.", screenshots=[])
    ]
    embedder.index_chunks(job_id, mock_chunks)
    
    query = "How do neural networks learn?"
    
    # 2. Benchmark Pre-Reranker (Alpha=1.0 Semantic Search only)
    t0 = time.perf_counter()
    pre_results = embedder.search_similar_chunks(query, limit=2)
    t1 = time.perf_counter()
    
    logger.info(f"[Pre-Reranker] Latency: {(t1 - t0) * 1000:.2f}ms")
    logger.info(f"[Pre-Reranker] Top-1: {pre_results[0].spoken_text if pre_results else 'None'} (Score: {pre_results[0].score if pre_results else 0})")
    
    # 3. Benchmark Post-Reranker (Hybrid)
    t2 = time.perf_counter()
    post_results = embedder.search_hybrid(query, limit=2)
    t3 = time.perf_counter()
    
    logger.info(f"[Post-Reranker] Latency: {(t3 - t2) * 1000:.2f}ms")
    logger.info(f"[Post-Reranker] Top-1: {post_results[0].spoken_text if post_results else 'None'} (Score: {post_results[0].score if post_results else 0})")
    
    if post_results and "backpropagation" in post_results[0].spoken_text:
        logger.info("✅ Reranking prioritized correct context.")
    
    logger.info("✅ Benchmark complete.")

if __name__ == "__main__":
    run_benchmark()
