from decimal import Decimal
from typing import Annotated, Literal, Self

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, JsonValue, WithJsonSchema, model_validator

Number = int | Annotated[float, Field(allow_inf_nan=False)]
Index = Annotated[int, Field(ge=0)]


def decimal_number(value: object) -> Decimal:
    if type(value) not in (int, float, Decimal):
        raise ValueError("Se requiere un número JSON, no un booleano ni una cadena.")
    number = Decimal(str(value))
    if not number.is_finite():
        raise ValueError("El importe debe ser finito.")
    return number


Money = Annotated[Decimal, BeforeValidator(decimal_number), WithJsonSchema({"type": "number"}, mode="validation")]


class Contract(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")


class Period(Contract):
    reventa: Money
    mantenimiento: Money


class ReplacementRequest(Contract):
    algoritmo: Literal["reemplazo-equipos"]
    costoInicial: Money
    plazo: Annotated[int, Field(ge=1, le=30)]
    vidaUtil: Annotated[int, Field(ge=1, le=10)]
    periodos: list[Period]

    @model_validator(mode="after")
    def check_periods(self) -> Self:
        if len(self.periodos) != self.vidaUtil:
            raise ValueError("periodos debe tener longitud igual a vidaUtil.")
        return self


class Reference(Contract):
    tabla: Literal["costosPorDuracion", "G", "siguientes"]
    indice: Index


class NumericChange(Contract):
    tabla: Literal["costosPorDuracion", "G"]
    indice: Index
    valor: Number


class DecisionChange(Contract):
    tabla: Literal["siguientes"]
    indice: Index
    valor: list[int]


class Step(Contract):
    orden: Annotated[int, Field(ge=1)]
    tipo: Literal["inicializacion", "evaluacion", "actualizacion", "reconstruccion", "resultado"]
    explicacion: str
    foco: Reference | None
    cambios: list[NumericChange | DecisionChange]
    datos: dict[str, JsonValue] | None = None


class Pagination(Contract):
    offset: Index
    limite: Annotated[int, Field(ge=1, le=100)]
    devueltos: Index
    hayMas: bool


class Result(Contract):
    costoMinimo: Number
    cantidadPlanesOptimos: Annotated[int, Field(ge=1)]
    planesOptimos: list[list[int]]
    conclusion: str
    paginacion: Pagination


class Tables(Contract):
    costosPorDuracion: list[Number]
    G: list[Number]
    siguientes: list[list[int]]


class Metadata(Contract):
    instanteInicial: Literal[0]
    instanteFinal: int
    costosIndexadosDesde: Literal[1]
    planesIncluyenInicioFin: Literal[True]


class ReplacementResponse(Contract):
    algoritmo: Literal["reemplazo-equipos"]
    resultado: Result
    tablas: Tables
    pasos: list[Step]
    metadatos: Metadata
