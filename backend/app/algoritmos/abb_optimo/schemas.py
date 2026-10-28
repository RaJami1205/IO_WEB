import unicodedata
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
Fila = Annotated[int, Field(ge=1)]


def decimal_number(value: object) -> Decimal:
    if type(value) not in (int, float, Decimal):
        raise ValueError("Se requiere un número JSON, no un booleano ni una cadena.")
    number = Decimal(str(value))
    if not number.is_finite():
        raise ValueError("El peso debe ser finito.")
    return number


# los limites evitan fracciones enormes al calcular con fraction
Money = Annotated[
    Decimal,
    BeforeValidator(decimal_number),
    WithJsonSchema({"type": "number"}, mode="validation"),
    Field(gt=0, le=Decimal("1000000000000"), decimal_places=6),
]
TextoLlave = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]


def clave_alfabetica(texto: str) -> str:
    # la ñ se marca antes de quitar acentos para que quede despues de la n
    texto = unicodedata.normalize("NFC", texto).casefold().replace("ñ", "n\U0010ffff")
    descompuesto = unicodedata.normalize("NFD", texto)
    return "".join(caracter for caracter in descompuesto if not unicodedata.combining(caracter))


class Contract(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")


class Llave(Contract):
    llave: TextoLlave
    peso: Money


class AbbRequest(Contract):
    algoritmo: Literal["abb-optimo"]
    llaves: Annotated[list[Llave], Field(min_length=1, max_length=10)]

    @model_validator(mode="after")
    def check_llaves(self) -> Self:
        vistas: dict[str, str] = {}
        repetidas = []
        for item in self.llaves:
            clave = clave_alfabetica(item.llave)
            if clave in vistas:
                repetidas.append(f"{vistas[clave]} y {item.llave}")
            else:
                vistas[clave] = item.llave
        if repetidas:
            raise ValueError("Las llaves no se pueden repetir. Repetidas: " + "; ".join(repetidas) + ".")
        return self


class LlaveOrdenada(Contract):
    posicion: Fila
    llave: str
    peso: Number
    probabilidad: Number
    probabilidadRedondeada: Number


class Result(Contract):
    costoPromedio: Number
    raiz: str
    llavesOrdenadas: list[LlaveOrdenada]
    conclusion: str


class Tables(Contract):
    A: list[list[Number | None]]
    R: list[list[Fila | None]]


class Metadata(Contract):
    filasDesde: Literal[1]
    columnasDesde: Literal[0]
    decimales: Literal[2]


class AbbResponse(Contract):
    algoritmo: Literal["abb-optimo"]
    resultado: Result
    tablas: Tables
    metadatos: Metadata