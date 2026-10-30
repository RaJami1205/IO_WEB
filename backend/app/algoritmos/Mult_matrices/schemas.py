# Define la cadena de dimensiones y la respuesta con costo, parentización y tablas.
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


Dimension = Annotated[int, Field(ge=1)]


Tabla = list[list[int | None]]


# Aplica validación estricta y rechaza campos ajenos al contrato.
class Contract(BaseModel):


    model_config = ConfigDict(strict=True, extra="forbid")


# ---------------------------------------------------------------------------
# Entrada
# ---------------------------------------------------------------------------

# Recibe n+1 dimensiones positivas que representan una cadena compatible de n matrices.
class MatricesRequest(Contract):

    algoritmo: Literal["multiplicacion-matrices"]
    dimensiones: Annotated[list[Dimension], Field(min_length=2, max_length=11)]


# ---------------------------------------------------------------------------
# Salida
# ---------------------------------------------------------------------------

# Resume el costo escalar mínimo y una parentización óptima.
class ResultadoMatrices(Contract):


    costoMinimo: int
    parentizacion: str
    conclusion: str


# Contiene los costos M y cortes P; None representa posiciones no utilizadas.
class TablasMatrices(Contract):


    M: Tabla
    P: Tabla


# Agrupa el resultado y las tablas enviados al frontend.
class MatricesResponse(Contract):


    algoritmo: Literal["multiplicacion-matrices"]
    resultado: ResultadoMatrices
    tablas: TablasMatrices
