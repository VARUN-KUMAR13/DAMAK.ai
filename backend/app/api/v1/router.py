"""Aggregate v1 routes."""

from fastapi import APIRouter

from app.api.v1 import jobs, live, intelligence

router = APIRouter()
router.include_router(jobs.router, tags=["jobs"])
router.include_router(live.router, prefix="/live", tags=["live"])
router.include_router(intelligence.router, prefix="/intelligence", tags=["intelligence"])
