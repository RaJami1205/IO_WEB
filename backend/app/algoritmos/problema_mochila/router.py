import json
from decimal import Decimal

from fastapi import APIRouter, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute

from app.algoritmos.problema_mochila.schemas import MochilaRequest, MochilaResponse
from app.algoritmos.problema_mochila.service import resolver_mochila


class DecimalRequest(Request):
    async def json(self):
        # conserva todos los digitos de cada numero del json
        return json.loads(await self.body(), parse_float=Decimal, parse_constant=Decimal)


class MochilaRoute(APIRoute):
    def get_route_handler(self):
        handler = super().get_route_handler()

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


@router.post("/problema-mochila", response_model=MochilaResponse)
def problema_mochila(solicitud: MochilaRequest) -> MochilaResponse:
    return resolver_mochila(solicitud)