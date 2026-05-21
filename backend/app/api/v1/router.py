"""Aggregate v1 routes."""

from fastapi import APIRouter

from app.api.v1 import jobs

router = APIRouter()
router.include_router(jobs.router, tags=["jobs"])
