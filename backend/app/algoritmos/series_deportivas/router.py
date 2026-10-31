# Atiende POST /api/series-deportivas y delega las probabilidades al servicio.
from fastapi import APIRouter

from app.algoritmos.series_deportivas.schemas import SeriesRequest, SeriesResponse
from app.algoritmos.series_deportivas.service import solve_series

router = APIRouter(prefix="/api", tags=["series-deportivas"])


# Entrega al servicio el formato de juegos y las probabilidades validados.
@router.post(
    "/series-deportivas",
    response_model=SeriesResponse,
    response_model_exclude_unset=True,
)
def series_deportivas(request: SeriesRequest) -> SeriesResponse:
    return solve_series(request)
