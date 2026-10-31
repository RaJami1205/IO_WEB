# Atiende POST /api/reemplazo-equipos y solicita al servicio una página de planes.
import json
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute

from app.algoritmos.reemplazo_equipos.schemas import ReplacementRequest, ReplacementResponse
from app.algoritmos.reemplazo_equipos.service import solve_replacement

# Conserva los importes decimales del cuerpo JSON antes de validarlos.
class DecimalRequest(Request):
    async def json(self):
        # Conserva todos los dígitos del token JSON antes de validar el modelo.
        return json.loads(await self.body(), parse_float=Decimal, parse_constant=Decimal)


class ReplacementRoute(APIRoute):
    """Evita que entradas NaN/Infinity rompan la serialización del error 422."""

    # Envuelve el manejador de FastAPI con la lectura decimal y el control de errores.
    def get_route_handler(self):
        handler = super().get_route_handler()

        # Procesa la solicitud y convierte sus errores de validación en HTTP 422.
        async def validated(request: Request):
            try:
                return await handler(DecimalRequest(request.scope, request.receive))
            except RequestValidationError as exc:
                # Conserva detail/loc/msg/type sin volver a serializar la entrada inválida.
                errors = [{key: error[key] for key in ("loc", "msg", "type")}
                          for error in exc.errors()]
                return JSONResponse(status_code=422, content={"detail": errors})

        return validated


router = APIRouter(prefix="/api", tags=["reemplazo-equipos"], route_class=ReplacementRoute)


# Delega el cálculo paginado y convierte los errores numéricos previstos en 422.
@router.post("/reemplazo-equipos", response_model=ReplacementResponse, response_model_exclude_unset=True)
def reemplazo_equipos(
    request: ReplacementRequest,
    offset: Annotated[int, Query(ge=0)] = 0,
    limite: Annotated[int, Query(ge=1, le=100)] = 100,
) -> ReplacementResponse:
    try:
        return solve_replacement(request, offset, limite)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
