

from fastapi import APIRouter

from app.algoritmos.Mult_matrices.schemas import (
    MatricesRequest,
    MatricesResponse,
)
from app.algoritmos.Mult_matrices.service import resolver_matrices

router = APIRouter(prefix="/api", tags=["multiplicacion-matrices"])


@router.post("/multiplicacion-matrices", response_model=MatricesResponse)
def multiplicacion_matrices(solicitud: MatricesRequest) -> MatricesResponse:
    """Resuelve la multiplicación de cadena de matrices."""
    return resolver_matrices(solicitud)
