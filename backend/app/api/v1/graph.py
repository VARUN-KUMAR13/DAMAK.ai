"""API Router for Knowledge Graph endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Request
from typing import Annotated

from app.core.config import Settings, get_settings
from app.services.intelligence.graph_service import GraphService

router = APIRouter(prefix="/graph", tags=["Graph"])

def get_graph_service(request: Request, settings: Annotated[Settings, Depends(get_settings)]) -> GraphService:
    # We will inject this into app.state in main.py
    return request.app.state.graph_service

GraphDep = Annotated[GraphService, Depends(get_graph_service)]

@router.get("/global")
async def get_global_graph(graph: GraphDep):
    """Returns the entire Knowledge Graph serialized for UI rendering."""
    try:
        return graph.get_global_graph()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
