from decimal import Decimal
from typing import Annotated, Literal, Self

from pydantic import (
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    StringConstraints,
    WithJsonSchema,
    model_validator,
)

Number = int | Annotated[float, Field(allow_inf_nan=False)]
Index = Annotated[int, Field(ge=0)]
PositiveInt = Annotated[int, Field(ge=1)]
Variante = Literal["0-1", "acotada", "no-acotada"]
Marca = Literal["verde", "rojo"]


def decimal_number(value: object) -> Decimal:
    if type(value) not in (int, float, Decimal):
        raise ValueError("Se requiere un número JSON, no un booleano ni una cadena.")
    number = Decimal(str(value))
    if not number.is_finite():
        raise ValueError("El valor debe ser finito.")
    return number


# los limites evitan fracciones enormes al calcular con fraction
Money = Annotated[
    Decimal,
    BeforeValidator(decimal_number),
    WithJsonSchema({"type": "number"}, mode="validation"),
    Field(gt=0, le=Decimal("1000000000000"), decimal_places=6),
]
Nombre = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]


class Contract(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")


class Objeto(Contract):
    nombre: Nombre
    peso: PositiveInt
    valor: Money
    cantidad: PositiveInt | None = None


class MochilaRequest(Contract):
    algoritmo: Literal["mochila"]
    variante: Variante
    capacidad: Annotated[int, Field(ge=1, le=20)]
    objetos: Annotated[list[Objeto], Field(min_length=1, max_length=10)]

    @model_validator(mode="after")
    def check_objetos(self) -> Self:
        if self.variante == "acotada":
            faltantes = [objeto.nombre for objeto in self.objetos if objeto.cantidad is None]
            if faltantes:
                raise ValueError("En la variante acotada cada objeto necesita cantidad. Falta en: "
                                 + ", ".join(faltantes) + ".")
        nombres = [objeto.nombre.casefold() for objeto in self.objetos]
        if len(set(nombres)) != len(nombres):
            raise ValueError("Los nombres de los objetos no se pueden repetir.")
        return self


class Seleccion(Contract):
    indice: PositiveInt
    nombre: str
    cantidad: PositiveInt
    pesoTotal: PositiveInt
    valorTotal: Number


class Result(Contract):
    valorOptimo: Number
    pesoUsado: Index
    seleccion: list[Seleccion]
    hayEmpates: bool
    conclusion: str


class Tables(Contract):
    V: list[list[Number]]
    decision: list[list[Index]]
    opciones: list[list[list[Index]]]
    marca: list[list[Marca]]


class Metadata(Contract):
    variante: Variante
    ejeFilas: Literal["capacidad"]
    ejeColumnas: Literal["objeto"]
    indicesDesde: Literal[0]
    objetos: list[str]


class MochilaResponse(Contract):
    algoritmo: Literal["mochila"]
    resultado: Result
    tablas: Tables
    metadatos: Metadata