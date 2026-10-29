# Define la entrada de reemplazo y la respuesta con costos, trazas y planes paginados.
from decimal import Decimal
from typing import Annotated, Literal, Self

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, JsonValue, WithJsonSchema, model_validator

Number = int | Annotated[float, Field(allow_inf_nan=False)]
Index = Annotated[int, Field(ge=0)]


# Convierte importes finitos a Decimal y rechaza cadenas y booleanos.
def decimal_number(value: object) -> Decimal:
    if type(value) not in (int, float, Decimal):
        raise ValueError("Se requiere un número JSON, no un booleano ni una cadena.")
    number = Decimal(str(value))
    if not number.is_finite():
        raise ValueError("El importe debe ser finito.")
    return number


Money = Annotated[Decimal, BeforeValidator(decimal_number), WithJsonSchema({"type": "number"}, mode="validation")]


# Aplica validación estricta y rechaza campos ajenos al contrato.
class Contract(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")


# Agrupa reventa y mantenimiento para una duración de uso del equipo.
class Period(Contract):
    reventa: Money
    mantenimiento: Money


# Recibe adquisición, horizonte, vida útil e importes por período.
class ReplacementRequest(Contract):
    algoritmo: Literal["reemplazo-equipos"]
    costoInicial: Money
    plazo: Annotated[int, Field(ge=1, le=30)]
    vidaUtil: Annotated[int, Field(ge=1, le=10)]
    periodos: list[Period]

    # Exige un registro de reventa y mantenimiento por cada período de vida útil.
    @model_validator(mode="after")
    def check_periods(self) -> Self:
        if len(self.periodos) != self.vidaUtil:
            raise ValueError("periodos debe tener longitud igual a vidaUtil.")
        return self


# Localiza una posición de las tablas unidimensionales de reemplazo.
class Reference(Contract):
    tabla: Literal["costosPorDuracion", "G", "siguientes"]
    indice: Index


# Registra un costo calculado para reproducir la tabla correspondiente.
class NumericChange(Contract):
    tabla: Literal["costosPorDuracion", "G"]
    indice: Index
    valor: Number


# Registra todos los siguientes instantes óptimos de un estado.
class DecisionChange(Contract):
    tabla: Literal["siguientes"]
    indice: Index
    valor: list[int]


# Describe un evento educativo con referencias, cambios y datos opcionales.
class Step(Contract):
    orden: Annotated[int, Field(ge=1)]
    tipo: Literal["inicializacion", "evaluacion", "actualizacion", "reconstruccion", "resultado"]
    explicacion: str
    foco: Reference | None
    cambios: list[NumericChange | DecisionChange]
    datos: dict[str, JsonValue] | None = None


# Identifica la página de planes devuelta y si quedan más resultados.
class Pagination(Contract):
    offset: Index
    limite: Annotated[int, Field(ge=1, le=100)]
    devueltos: Index
    hayMas: bool


# Resume el costo mínimo, el conteo total y la página de planes óptimos.
class Result(Contract):
    costoMinimo: Number
    cantidadPlanesOptimos: Annotated[int, Field(ge=1)]
    planesOptimos: list[list[int]]
    conclusion: str
    paginacion: Pagination


# Reúne costos por duración, costos futuros G(t) y decisiones óptimas.
class Tables(Contract):
    costosPorDuracion: list[Number]
    G: list[Number]
    siguientes: list[list[int]]


# Explicita el horizonte y las convenciones de índices y extremos de los planes.
class Metadata(Contract):
    instanteInicial: Literal[0]
    instanteFinal: int
    costosIndexadosDesde: Literal[1]
    planesIncluyenInicioFin: Literal[True]


# Agrupa resultado, tablas, pasos y metadatos de reemplazo.
class ReplacementResponse(Contract):
    algoritmo: Literal["reemplazo-equipos"]
    resultado: Result
    tablas: Tables
    pasos: list[Step]
    metadatos: Metadata
