from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field


class Contract(BaseModel):
    model_config = ConfigDict(
        strict=True,
        extra="forbid"
    )


class MatricesRequest(Contract):
    algoritmo: Literal["multiplicacion-matrices"]

    dimensiones: Annotated[
        list[Annotated[int, Field(gt=0)]],
        Field(min_length=2, max_length=11)
    ]


class ResultadoMatrices(Contract):
    costoMinimo: int
    parentizacion: str
    conclusion: str


class TablasMatrices(Contract):
    M: list[list[int | None]]
    P: list[list[int | None]]


class MatricesResponse(Contract):
    algoritmo: Literal["multiplicacion-matrices"]
    resultado: ResultadoMatrices
    tablas: TablasMatrices
