import asyncio
import uuid
import logging
from unittest.mock import patch

from app.core.config import get_settings
from app.services.intelligence.graph_service import GraphService
from app.services.intelligence.graph_enrichment_service import GraphEnrichmentService
from app.services.storage.job_store import JobStore
from app.services.pipeline.chunk_service import ChunkService
from app.schemas.chunk import ChunkPayload

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def run_verification():
    settings = get_settings()
    job_store = JobStore(settings)
    graph = GraphService(settings)
    chunk_service = ChunkService(settings)
    # Use a dummy OllamaService to mock the LLM
    class DummyOllama:
        async def generate_response(self, prompt, json_format):
            return '[{"concept": "Machine Learning", "description": "Study of algorithms"}, {"concept": "Deep Learning", "description": "Neural Networks"}]'
            
    enrichment = GraphEnrichmentService(settings, job_store, DummyOllama(), graph)
    
    logger.info("--- PHASE 9C VERIFICATION ---")
    
    job_id = str(uuid.uuid4())
    logger.info(f"Simulating Job: {job_id}")
    
    # 1. Test Fast-Path Extraction (ChunkService)
    # Provide a chunk with some technical terms
    payload = ChunkPayload(
        job_id=job_id,
        duration_sec=30.0,
        transcription=[
            {"start": 0, "end": 10, "text": "Welcome to the Machine Learning course. Deep Learning is very important."},
            {"start": 10, "end": 20, "text": "Because we should use Neural Networks without overfitting."}
        ],
        screenshots=[]
    )
    
    chunks = chunk_service.process_chunks(payload)
    job_store.save_chunks(uuid.UUID(job_id), chunks)
    
    # Verify keyword extraction (Stage 1)
    extracted_keywords = []
    for c in chunks:
        extracted_keywords.extend(c.get('keywords', []))
    
    logger.info(f"Stage 1 Extracted Keywords: {extracted_keywords}")
    assert any("Machine" in k for k in extracted_keywords), "Fast path regex extraction failed to capture capitalized terms."
    
    # 2. Test Async Enrichment (Stage 2)
    logger.info("Running Stage 2 Async Enrichment Job...")
    await enrichment.run_enrichment(job_id)
    
    # 3. Test Graph Storage and Traversal
    global_graph = graph.get_global_graph()
    
    nodes = global_graph.get('nodes', [])
    links = global_graph.get('links', [])
    
    # Verify deduplication & Edge generation
    assert len(nodes) >= 3, "Expected at least 1 Lecture node and 2 Concept nodes"
    assert len(links) >= 2, "Expected at least 2 edges linking concepts to the lecture"
    
    ml_node = next((n for n in nodes if n.get('label') == 'Machine Learning'), None)
    assert ml_node is not None, "Concept node not persisted in SQLite/NetworkX"
    
    logger.info("✅ SQLite Persistence & NetworkX Traversal Verified.")
    logger.info(f"Graph Shape: {len(nodes)} Nodes, {len(links)} Edges.")

if __name__ == "__main__":
    asyncio.run(run_verification())
