import asyncio
import time
import uuid
import logging
from uuid import UUID

from app.core.config import get_settings
from app.services.embeddings.embedding_service import EmbeddingService
from app.schemas.chunk import MultimodalChunk

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def run_verification():
    settings = get_settings()
    embeddings = EmbeddingService(settings)
    
    logger.info("--- PHASE 9A VERIFICATION ---")
    
    # 1. Insert Dummy Data (3 Lectures)
    logger.info("Inserting dummy data for 3 lectures...")
    job_1 = uuid.uuid4()
    job_2 = uuid.uuid4()
    job_3 = uuid.uuid4()
    
    chunks_1 = [
        MultimodalChunk(chunk_id="1", start_time=0, end_time=10, spoken_text="Welcome to machine learning. Today we discuss Neural Networks and how they learn.", screenshots=[], combined_text="Welcome to machine learning. Today we discuss Neural Networks and how they learn."),
        MultimodalChunk(chunk_id="2", start_time=10, end_time=20, spoken_text="Deep learning relies heavily on vector mathematics and embeddings.", screenshots=[], combined_text="Deep learning relies heavily on vector mathematics and embeddings.")
    ]
    chunks_2 = [
        MultimodalChunk(chunk_id="1", start_time=0, end_time=10, spoken_text="In this database lecture, we talk about vector databases like ChromaDB.", screenshots=[], combined_text="In this database lecture, we talk about vector databases like ChromaDB."),
        MultimodalChunk(chunk_id="2", start_time=10, end_time=20, spoken_text="RAG, or Retrieval-Augmented Generation, uses embeddings to fetch context.", screenshots=[], combined_text="RAG, or Retrieval-Augmented Generation, uses embeddings to fetch context.")
    ]
    chunks_3 = [
        MultimodalChunk(chunk_id="1", start_time=0, end_time=10, spoken_text="Transformers revolutionized NLP by using self-attention.", screenshots=[], combined_text="Transformers revolutionized NLP by using self-attention."),
        MultimodalChunk(chunk_id="2", start_time=10, end_time=20, spoken_text="Embeddings capture semantic meaning. We use them for hybrid search.", screenshots=[], combined_text="Embeddings capture semantic meaning. We use them for hybrid search.")
    ]
    
    embeddings.index_chunks(job_1, chunks_1)
    embeddings.index_chunks(job_2, chunks_2)
    embeddings.index_chunks(job_3, chunks_3)
    
    # 2. Test Hybrid vs Vector vs BM25
    query = "explain vector databases and RAG"
    logger.info(f"\n--- Testing Query: '{query}' ---")
    
    t0 = time.perf_counter()
    vector_res = embeddings.search_hybrid(query, limit=5, alpha=1.0)
    logger.info(f"Vector (alpha=1.0) in {time.perf_counter()-t0:.4f}s: {[c.spoken_text[:50] for c in vector_res]}")
    
    t0 = time.perf_counter()
    bm25_res = embeddings.search_hybrid(query, limit=5, alpha=0.0)
    logger.info(f"BM25 (alpha=0.0) in {time.perf_counter()-t0:.4f}s: {[c.spoken_text[:50] for c in bm25_res]}")
    
    t0 = time.perf_counter()
    hybrid_res = embeddings.search_hybrid(query, limit=5, alpha=0.5)
    logger.info(f"Hybrid (alpha=0.5) in {time.perf_counter()-t0:.4f}s: {[c.spoken_text[:50] for c in hybrid_res]}")
    
    # Check multi-lecture retrieval
    unique_jobs = set(str(c.job_id) for c in hybrid_res)
    logger.info(f"Unique source lectures retrieved: {len(unique_jobs)}")
    
    # 3. Stress Testing (Mock 50 Lectures)
    logger.info("\n--- Stress Testing 50 Lectures ---")
    for i in range(50):
        mock_job = uuid.uuid4()
        mock_chunks = [
            MultimodalChunk(chunk_id=str(j), start_time=0, end_time=10, spoken_text=f"Mock data point {j} for lecture {i} about general topics and generic embeddings.", screenshots=[], combined_text=f"Mock data point {j} for lecture {i} about general topics and generic embeddings.")
            for j in range(10)
        ]
        embeddings.index_chunks(mock_job, mock_chunks)
        
    t0 = time.perf_counter()
    stress_res = embeddings.search_hybrid(query, limit=5, alpha=0.5)
    t_stress = time.perf_counter() - t0
    logger.info(f"Stress Hybrid Search Latency (50+ lectures, 500+ chunks): {t_stress:.4f}s")
    
    # Cleanup DB if needed, but since it's local test it's fine.
    logger.info("Verification Complete.")

if __name__ == "__main__":
    asyncio.run(run_verification())
