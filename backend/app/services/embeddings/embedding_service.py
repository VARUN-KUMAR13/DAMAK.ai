"""Embedding generation and vector storage using sentence-transformers and ChromaDB."""

from __future__ import annotations

import logging
from typing import List, Optional, Any
from uuid import UUID

import chromadb
from chromadb.config import Settings as ChromaSettings
from sentence_transformers import SentenceTransformer

from app.core.config import Settings
from app.schemas.chunk import MultimodalChunk
from app.schemas.search import SearchResultChunk

logger = logging.getLogger(__name__)


class EmbeddingError(RuntimeError):
    """Raised when embedding generation or vector DB operations fail."""


class EmbeddingService:
    """Service for managing vector embeddings and semantic search."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._model: Optional[SentenceTransformer] = None
        self._chroma_client: Optional[chromadb.PersistentClient] = None
        self._collection_name = "lecture_chunks"

    def _get_model(self) -> SentenceTransformer:
        """Lazy initialization of sentence-transformers model."""
        if self._model is None:
            try:
                logger.info("Loading embedding model: %s", self._settings.embedding_model)
                self._model = SentenceTransformer(
                    self._settings.embedding_model,
                    device=self._settings.embedding_device
                )
            except Exception as e:
                logger.error("Failed to load embedding model: %s", e)
                raise EmbeddingError(f"Model loading failed: {e}") from e
        return self._model

    def _get_chroma_client(self) -> chromadb.PersistentClient:
        """Lazy initialization of ChromaDB client."""
        if self._chroma_client is None:
            try:
                db_path = str(self._settings.chroma_db_dir.resolve())
                logger.info("Initializing ChromaDB at: %s", db_path)
                self._chroma_client = chromadb.PersistentClient(path=db_path)
            except Exception as e:
                logger.error("Failed to initialize ChromaDB: %s", e)
                raise EmbeddingError(f"ChromaDB initialization failed: {e}") from e
        return self._chroma_client

    def index_chunks(self, job_id: UUID, chunks: List[MultimodalChunk]) -> None:
        """
        Generate embeddings for chunks and store them in ChromaDB.
        """
        if not chunks:
            logger.warning("No chunks provided to index for job %s", job_id)
            return

        logger.info("Indexing %d chunks for job %s", len(chunks), job_id)
        model = self._get_model()
        client = self._get_chroma_client()
        
        try:
            collection = client.get_or_create_collection(name=self._collection_name)
            
            texts = [chunk.combined_text for chunk in chunks]
            embeddings = model.encode(texts).tolist()
            
            ids = [f"{job_id}_{chunk.chunk_id}" for chunk in chunks]
            metadatas = [
                {
                    "job_id": str(job_id),
                    "chunk_id": chunk.chunk_id,
                    "start_time": chunk.start_time,
                    "end_time": chunk.end_time,
                    "slide_text": chunk.slide_text or "",
                    "spoken_text": chunk.spoken_text,
                    "screenshots": ",".join(chunk.screenshots)
                }
                for chunk in chunks
            ]

            collection.add(
                ids=ids,
                embeddings=embeddings,
                metadatas=metadatas,
                documents=texts
            )
            logger.info("Successfully indexed %d chunks for job %s", len(chunks), job_id)
        except Exception as e:
            logger.error("Failed to index chunks for job %s: %s", job_id, e)
            raise EmbeddingError(f"Indexing failed: {e}") from e

    def search_similar_chunks(
        self, 
        query: str, 
        job_id: Optional[UUID] = None, 
        limit: int = 5
    ) -> List[SearchResultChunk]:
        """
        Perform semantic search across indexed chunks.
        """
        model = self._get_model()
        client = self._get_chroma_client()
        
        try:
            collection = client.get_or_create_collection(name=self._collection_name)
            query_embedding = model.encode([query]).tolist()
            
            where = {"job_id": str(job_id)} if job_id else None
            
            results = collection.query(
                query_embeddings=query_embedding,
                n_results=limit,
                where=where
            )
            
            search_results = []
            if results["ids"] and results["ids"][0]:
                for i in range(len(results["ids"][0])):
                    meta = results["metadatas"][0][i]
                    # ChromaDB distances are often squared L2, smaller is better.
                    # We'll return the raw distance or convert to a simple score if needed.
                    # For consistency with user request, we'll call it 'score'.
                    dist = results["distances"][0][i]
                    # Simple heuristic for similarity score (0 to 1)
                    score = max(0.0, 1.0 - (dist / 2.0)) 

                    search_results.append(SearchResultChunk(
                        chunk_id=meta["chunk_id"],
                        job_id=UUID(meta["job_id"]),
                        score=round(float(score), 4),
                        start_time=float(meta["start_time"]),
                        end_time=float(meta["end_time"]),
                        text=results["documents"][0][i],
                        slide_text=meta["slide_text"] if meta["slide_text"] else None,
                        spoken_text=meta["spoken_text"],
                        screenshots=meta["screenshots"].split(",") if meta["screenshots"] else []
                    ))
            
            return search_results
        except Exception as e:
            logger.error("Semantic search failed: %s", e)
            raise EmbeddingError(f"Search failed: {e}") from e
