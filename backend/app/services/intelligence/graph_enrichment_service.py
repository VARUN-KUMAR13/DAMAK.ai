"""Asynchronous job to enrich the Knowledge Graph from lecture chunks."""

import logging
import asyncio
import uuid
import json
from typing import List, Dict

from app.core.config import Settings
from app.services.llm.ollama_service import OllamaService
from app.services.intelligence.graph_service import GraphService
from app.services.storage.job_store import JobStore

logger = logging.getLogger(__name__)

class GraphEnrichmentService:
    def __init__(self, settings: Settings, job_store: JobStore, ollama_service: OllamaService, graph_service: GraphService):
        self.settings = settings
        self.job_store = job_store
        self.ollama = ollama_service
        self.graph = graph_service

    async def run_enrichment(self, job_id: str):
        """Runs Stage 2 Enrichment: Processes chunks asynchronously to build nodes and edges."""
        logger.info(f"Starting async Knowledge Enrichment for Job: {job_id}")
        
        try:
            chunks = self.job_store.load_chunks(uuid.UUID(job_id))
            if not chunks:
                logger.warning(f"No chunks found for job {job_id}. Aborting enrichment.")
                return

            # Add Lecture Node
            lecture_node_id = self.graph.upsert_node(
                label=f"Lecture {job_id[:8]}", 
                node_type="Lecture", 
                metadata={"job_id": job_id}
            )

            # Gather all Stage 1 keywords
            all_keywords = []
            for c in chunks:
                all_keywords.extend(c.get('keywords', []))
            
            # Deduplicate locally before sending to LLM
            unique_keywords = list(set(all_keywords))
            
            if not unique_keywords:
                logger.warning("No keywords found to enrich.")
                return
                
            # Batched processing to not overwhelm context
            batch_size = 30
            for i in range(0, len(unique_keywords), batch_size):
                batch = unique_keywords[i:i+batch_size]
                prompt = (
                    "You are a Knowledge Graph AI.\n"
                    "Given the following list of keywords extracted from a lecture, identify the core conceptual topics.\n"
                    "Group synonyms, fix casing, and return a clean JSON array of distinct concepts.\n"
                    "Format: [{\"concept\": \"Machine Learning\", \"description\": \"Study of algorithms that learn from data\"}]\n"
                    f"Keywords: {', '.join(batch)}\n"
                    "Respond ONLY with the JSON array."
                )
                
                try:
                    res = await self.ollama.generate_response(prompt, json_format=True)
                    structured = self._parse_json(res)
                    
                    for item in structured:
                        concept_label = item.get("concept")
                        desc = item.get("description")
                        if concept_label:
                            # 1. Create Concept Node
                            node_id = self.graph.upsert_node(
                                label=concept_label, 
                                node_type="Concept", 
                                description=desc,
                                metadata={"job_id": job_id}
                            )
                            # 2. Link Concept -> Lecture (BELONGS_TO)
                            self.graph.add_edge(node_id, lecture_node_id, "BELONGS_TO", weight=1.0)
                except Exception as e:
                    logger.error(f"Error enriching batch: {e}")
                    
            logger.info(f"Completed Knowledge Enrichment for Job: {job_id}")

        except Exception as e:
            logger.error(f"Failed Knowledge Enrichment for Job {job_id}: {e}")

    def _parse_json(self, text: str) -> List[Dict]:
        try:
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()
                
            data = json.loads(text)
            if not isinstance(data, list):
                if isinstance(data, dict) and "concepts" in data:
                    return data["concepts"]
                return [data]
            return data
        except Exception:
            return []
