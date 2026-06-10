"""Service for managing the hybrid Knowledge Graph (SQLite + NetworkX)."""

import logging
import sqlite3
import uuid
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Any, Optional

import networkx as nx

from app.core.config import Settings

logger = logging.getLogger(__name__)

class GraphService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.settings.storage_graph.mkdir(parents=True, exist_ok=True)
        self.db_path = self.settings.storage_graph / "graph.db"
        self._init_db()
        self.graph = nx.DiGraph()
        self._load_networkx()

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._get_conn() as conn:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS nodes (
                    id TEXT PRIMARY KEY,
                    type TEXT NOT NULL,
                    label TEXT NOT NULL UNIQUE,
                    description TEXT,
                    metadata TEXT
                )
            ''')
            conn.execute('''
                CREATE TABLE IF NOT EXISTS edges (
                    id TEXT PRIMARY KEY,
                    source_id TEXT NOT NULL,
                    target_id TEXT NOT NULL,
                    type TEXT NOT NULL,
                    weight REAL DEFAULT 1.0,
                    metadata TEXT,
                    FOREIGN KEY(source_id) REFERENCES nodes(id),
                    FOREIGN KEY(target_id) REFERENCES nodes(id),
                    UNIQUE(source_id, target_id, type)
                )
            ''')
            # Phase 9D: Database Optimization Indexing
            conn.execute("CREATE INDEX IF NOT EXISTS idx_nodes_label ON nodes(label)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id)")
            
            conn.commit()

    def _load_networkx(self):
        """Loads nodes and edges from SQLite into NetworkX for fast traversal."""
        self.graph.clear()
        with self._get_conn() as conn:
            nodes = conn.execute("SELECT * FROM nodes").fetchall()
            for row in nodes:
                meta = json.loads(row['metadata']) if row['metadata'] else {}
                self.graph.add_node(
                    row['id'], 
                    type=row['type'], 
                    label=row['label'], 
                    description=row['description'],
                    **meta
                )

            edges = conn.execute("SELECT * FROM edges").fetchall()
            for row in edges:
                meta = json.loads(row['metadata']) if row['metadata'] else {}
                self.graph.add_edge(
                    row['source_id'], 
                    row['target_id'], 
                    id=row['id'],
                    type=row['type'],
                    weight=row['weight'],
                    **meta
                )

    def upsert_node(self, label: str, node_type: str, description: Optional[str] = None, metadata: Optional[Dict] = None) -> str:
        """Insert or update a node. Deduplicates by lowercase label."""
        label_norm = label.strip()
        label_lower = label_norm.lower()
        
        with self._get_conn() as conn:
            # Check if exists (case-insensitive deduplication)
            existing = conn.execute("SELECT id FROM nodes WHERE LOWER(label) = ?", (label_lower,)).fetchone()
            
            meta_str = json.dumps(metadata or {})
            
            if existing:
                node_id = existing['id']
                if description or metadata:
                    updates = []
                    params = []
                    if description:
                        updates.append("description = ?")
                        params.append(description)
                    if metadata:
                        updates.append("metadata = ?")
                        params.append(meta_str)
                    
                    params.append(node_id)
                    conn.execute(f"UPDATE nodes SET {', '.join(updates)} WHERE id = ?", params)
            else:
                node_id = str(uuid.uuid4())
                conn.execute(
                    "INSERT INTO nodes (id, type, label, description, metadata) VALUES (?, ?, ?, ?, ?)",
                    (node_id, node_type, label_norm, description, meta_str)
                )
            conn.commit()
            
        # Keep NetworkX in sync
        self._load_networkx()
        return node_id

    def add_edge(self, source_id: str, target_id: str, edge_type: str, weight: float = 1.0, metadata: Optional[Dict] = None):
        """Add an edge between two nodes."""
        meta_str = json.dumps(metadata or {})
        with self._get_conn() as conn:
            conn.execute('''
                INSERT OR REPLACE INTO edges (id, source_id, target_id, type, weight, metadata)
                VALUES (
                    COALESCE((SELECT id FROM edges WHERE source_id=? AND target_id=? AND type=?), ?),
                    ?, ?, ?, ?, ?
                )
            ''', (source_id, target_id, edge_type, str(uuid.uuid4()), source_id, target_id, edge_type, weight, meta_str))
            conn.commit()
            
        self._load_networkx()

    def get_global_graph(self) -> Dict[str, Any]:
        """Serialize the NetworkX graph for D3/force-graph frontend visualization."""
        data = nx.node_link_data(self.graph)
        return data
