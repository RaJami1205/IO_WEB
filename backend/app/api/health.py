# Expone GET /api/health para comprobar la disponibilidad de la API.
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api", tags=["health"])


# Define la respuesta de disponibilidad que consume el frontend.
class HealthResponse(BaseModel):
    status: Literal["ok"]


# Confirma que la API puede atender solicitudes.
@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok")
