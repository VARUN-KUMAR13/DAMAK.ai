"""Context Window Management for LLM interactions."""

import logging
from typing import List, Dict, Any
import tiktoken

from app.schemas.search import SearchResultChunk

logger = logging.getLogger(__name__)

class ContextManager:
    """Manages context window budgets and source diversity constraints."""
    
    def __init__(self, model_name: str = "gpt-3.5-turbo"):
        # We use a standard encoding as a proxy for Ollama local models
        try:
            self.encoding = tiktoken.encoding_for_model(model_name)
        except KeyError:
            self.encoding = tiktoken.get_encoding("cl100k_base")
            
    def count_tokens(self, text: str) -> int:
        """Returns the number of tokens in a text string."""
        if not text:
            return 0
        return len(self.encoding.encode(text))

    def build_chat_context(self, query: str, candidates: List[SearchResultChunk], max_context_tokens: int = 3000) -> str:
        """
        Builds a context string from chunks while strictly enforcing a token limit
        and maintaining source diversity (no single job > 50% of budget if there are other jobs).
        """
        if not candidates:
            return ""
            
        # Group candidates by source (job_id)
        sources: Dict[str, List[SearchResultChunk]] = {}
        for c in candidates:
            job_str = str(c.job_id)
            if job_str not in sources:
                sources[job_str] = []
            sources[job_str].append(c)
            
        source_limits = {}
        total_sources = len(sources)
        
        # Enforce diversity: if >1 source, max 50% tokens per source
        if total_sources > 1:
            per_source_max = int(max_context_tokens * 0.5)
        else:
            per_source_max = max_context_tokens
            
        current_tokens = 0
        accepted_chunks = []
        
        # Flatten chunks keeping reranker order
        for chunk in candidates:
            job_str = str(chunk.job_id)
            chunk_text = f"[Source: {job_str} | Time: {chunk.start_time}-{chunk.end_time}]\n{chunk.text}\n---\n"
            tokens = self.count_tokens(chunk_text)
            
            # Check global budget
            if current_tokens + tokens > max_context_tokens:
                continue
                
            # Check diversity budget
            source_current = source_limits.get(job_str, 0)
            if source_current + tokens > per_source_max:
                # But wait, if we still have global budget left and we've exhausted all other sources, 
                # we might want to relax this. For strict diversity, we skip.
                continue
                
            source_limits[job_str] = source_current + tokens
            current_tokens += tokens
            accepted_chunks.append(chunk_text)
            
        final_context = "".join(accepted_chunks)
        logger.info(f"Context built: {len(accepted_chunks)}/{len(candidates)} chunks used. Total tokens: {current_tokens}/{max_context_tokens}")
        return final_context
