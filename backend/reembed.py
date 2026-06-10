import asyncio
import json
from pathlib import Path
from uuid import UUID

from app.core.config import get_settings
from app.schemas.chunk import MultimodalChunk
from app.services.embeddings.embedding_service import EmbeddingService

async def main():
    settings = get_settings()
    service = EmbeddingService(settings)
    
    chunks_dir = Path(settings.storage_chunks)
    for job_dir in chunks_dir.iterdir():
        if not job_dir.is_dir():
            continue
            
        json_path = job_dir / "chunks.json"
        if not json_path.exists():
            continue
            
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        job_id = UUID(data["job_id"])
        chunks = []
        for c in data.get("chunks", []):
            chunks.append(MultimodalChunk(**c))
            
        print(f"Re-embedding {len(chunks)} chunks for {job_id}...")
        service.index_chunks(job_id, chunks)

if __name__ == "__main__":
    asyncio.run(main())
