from fastapi import APIRouter

from app.api.v1.endpoints import auth, health, notes

api_router = APIRouter()

# Core health check
api_router.include_router(health.router, tags=["Health"])

# Authentication & Sessions
api_router.include_router(auth.router)

# Encrypted Notes CRUD
api_router.include_router(notes.router)
