# Define las llaves de entrada, su validación y la respuesta con tablas A y R.
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


# Convierte números finitos a Decimal y rechaza cadenas y booleanos.
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


# Genera una clave de orden y comparación sin mayúsculas ni acentos, conservando ñ.
def clave_alfabetica(texto: str) -> str:
    # la ñ se marca antes de quitar acentos para que quede despues de la n
    texto = unicodedata.normalize("NFC", texto).casefold().replace("ñ", "n\U0010ffff")
    descompuesto = unicodedata.normalize("NFD", texto)
    return "".join(caracter for caracter in descompuesto if not unicodedata.combining(caracter))


# Aplica validación estricta y rechaza campos ajenos al contrato.
class Contract(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")


# Asocia una llave de búsqueda con su peso positivo.
class Llave(Contract):
    llave: TextoLlave
    peso: Money


# Recibe las llaves en el orden ingresado y comprueba su unicidad.
class AbbRequest(Contract):
    algoritmo: Literal["abb-optimo"]
    llaves: Annotated[list[Llave], Field(min_length=1, max_length=10)]

    # Rechaza llaves equivalentes según la normalización alfabética del módulo.
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


# Describe la posición ordenada y las probabilidades exacta y redondeada de una llave.
class LlaveOrdenada(Contract):
    posicion: Fila
    llave: str
    peso: Number
    probabilidad: Number
    probabilidadRedondeada: Number


# Resume el costo esperado, la raíz elegida y las llaves ordenadas.
class Result(Contract):
    costoPromedio: Number
    raiz: str
    llavesOrdenadas: list[LlaveOrdenada]
    conclusion: str


# Contiene costos A y raíces R; None identifica posiciones no aplicables.
class Tables(Contract):
    A: list[list[Number | None]]
    R: list[list[Fila | None]]


# Indica los índices de presentación y los decimales utilizados.
class Metadata(Contract):
    filasDesde: Literal[1]
    columnasDesde: Literal[0]
    decimales: Literal[2]


# Agrupa el resultado, las tablas y los metadatos enviados al frontend.
class AbbResponse(Contract):
    algoritmo: Literal["abb-optimo"]
    resultado: Result
    tablas: Tables
    metadatos: Metadata