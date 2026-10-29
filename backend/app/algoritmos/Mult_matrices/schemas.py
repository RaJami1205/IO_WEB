
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


Dimension = Annotated[int, Field(ge=1)]


Tabla = list[list[int | None]]


class Contract(BaseModel):


    model_config = ConfigDict(strict=True, extra="forbid")


# ---------------------------------------------------------------------------
# Entrada
# ---------------------------------------------------------------------------

class MatricesRequest(Contract):

    algoritmo: Literal["multiplicacion-matrices"]
    dimensiones: Annotated[list[Dimension], Field(min_length=2)]


# ---------------------------------------------------------------------------
# Salida
# ---------------------------------------------------------------------------

class ResultadoMatrices(Contract):


    costoMinimo: int
    parentizacion: str
    conclusion: str


class TablasMatrices(Contract):


    M: Tabla
    P: Tabla


class MatricesResponse(Contract):


    algoritmo: Literal["multiplicacion-matrices"]
    resultado: ResultadoMatrices
    tablas: TablasMatrices
