# Atiende POST /api/problema-mochila y delega la variante solicitada al servicio.
import json
from decimal import Decimal

from fastapi import APIRouter, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute

from app.algoritmos.problema_mochila.schemas import MochilaRequest, MochilaResponse
from app.algoritmos.problema_mochila.service import resolver_mochila


# Conserva los decimales del cuerpo JSON antes de la validación.
class DecimalRequest(Request):
    # Lee los números fraccionarios como Decimal para evitar redondeos iniciales.
    async def json(self):
        return json.loads(await self.body(), parse_float=Decimal, parse_constant=Decimal)


# Adapta la lectura decimal y la respuesta de errores de validación del módulo.
class MochilaRoute(APIRoute):
    # Envuelve el manejador de FastAPI con la lectura y validación decimal.
    def get_route_handler(self):
        handler = super().get_route_handler()

        # Procesa la solicitud y devuelve errores 422 sin la entrada no serializable.
        async def handler_decimal(request: Request):
            try:
                return await handler(DecimalRequest(request.scope, request.receive))
            except RequestValidationError as exc:
                # se omite input para no serializar valores como nan o infinity
                errores = [
                    {clave: error[clave] for clave in ("loc", "msg", "type")}
                    for error in exc.errors()
                ]
                return JSONResponse(status_code=422, content={"detail": errores})

        return handler_decimal


router = APIRouter(prefix="/api", tags=["problema-mochila"], route_class=MochilaRoute)


# Entrega al servicio la capacidad, los objetos y la variante validados.
@router.post("/problema-mochila", response_model=MochilaResponse)
def problema_mochila(solicitud: MochilaRequest) -> MochilaResponse:
    return resolver_mochila(solicitud)