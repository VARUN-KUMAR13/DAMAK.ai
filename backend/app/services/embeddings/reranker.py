"""Reranker interfaces and implementations for Hybrid Search."""

from typing import List
from abc import ABC, abstractmethod
import logging

from app.schemas.search import SearchResultChunk

logger = logging.getLogger(__name__)

class RerankerInterface(ABC):
    """Interface for Cross-Encoder reranking models."""
    
    @abstractmethod
    def rerank(self, query: str, candidates: List[SearchResultChunk], top_k: int = 5) -> List[SearchResultChunk]:
        """Reranks the candidate chunks based on the query."""
        pass

class DummyReranker(RerankerInterface):
    """Fallback pass-through reranker."""
    def rerank(self, query: str, candidates: List[SearchResultChunk], top_k: int = 5) -> List[SearchResultChunk]:
        return candidates[:top_k]

class MiniLMReranker(RerankerInterface):
    """Lightweight, fast CPU reranker using ms-marco-MiniLM-L-6-v2."""
    def __init__(self, device: str = "cpu"):
        try:
            from sentence_transformers import CrossEncoder
            logger.info("Loading MiniLMReranker (cross-encoder/ms-marco-MiniLM-L-6-v2)...")
            self.model = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2', max_length=512, device=device)
        except Exception as e:
            logger.error(f"Failed to load MiniLMReranker: {e}")
            self.model = None

    def rerank(self, query: str, candidates: List[SearchResultChunk], top_k: int = 5) -> List[SearchResultChunk]:
        if not self.model or not candidates:
            return candidates[:top_k]
            
        pairs = [[query, doc.text] for doc in candidates]
        try:
            scores = self.model.predict(pairs)
            for i, score in enumerate(scores):
                candidates[i].score = float(score)
            
            # Re-sort based on cross-encoder score
            candidates.sort(key=lambda x: x.score, reverse=True)
            return candidates[:top_k]
        except Exception as e:
            logger.error(f"Reranking failed: {e}")
            return candidates[:top_k]

class BGEReranker(RerankerInterface):
    """Optional heavy reranker using BAAI/bge-reranker-base."""
    def __init__(self, device: str = "cpu"):
        try:
            from sentence_transformers import CrossEncoder
            logger.info("Loading BGEReranker (BAAI/bge-reranker-base)...")
            self.model = CrossEncoder('BAAI/bge-reranker-base', max_length=512, device=device)
        except Exception as e:
            logger.error(f"Failed to load BGEReranker: {e}")
            self.model = None

    def rerank(self, query: str, candidates: List[SearchResultChunk], top_k: int = 5) -> List[SearchResultChunk]:
        if not self.model or not candidates:
            return candidates[:top_k]
            
        pairs = [[query, doc.text] for doc in candidates]
        try:
            scores = self.model.predict(pairs)
            for i, score in enumerate(scores):
                candidates[i].score = float(score)
            
            candidates.sort(key=lambda x: x.score, reverse=True)
            return candidates[:top_k]
        except Exception as e:
            logger.error(f"Reranking failed: {e}")
            return candidates[:top_k]

def get_reranker(model_name: str = "mini-lm", device: str = "cpu") -> RerankerInterface:
    if model_name == "bge":
        return BGEReranker(device)
    elif model_name == "dummy":
        return DummyReranker()
    else:
        return MiniLMReranker(device)
