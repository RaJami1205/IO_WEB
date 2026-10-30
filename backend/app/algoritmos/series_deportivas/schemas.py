# Define la configuración de la serie y las probabilidades, tablas y eventos de salida.
from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

Probability = Annotated[float, Field(ge=0, le=1, allow_inf_nan=False)]
Index = Annotated[int, Field(ge=0)]


# Aplica validación estricta y rechaza campos ajenos al contrato.
class ContractModel(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")


# Recibe probabilidades de local y visitante y la localía de cada juego.
class SeriesRequest(ContractModel):
    algoritmo: Literal["series-deportivas"]
    juegos: Annotated[int, Field(ge=1, le=11)]
    ph: Probability
    pr: Probability
    formato: list[bool]

    # Exige una cantidad impar de juegos y una localía por partido.
    @model_validator(mode="after")
    def validate_series(self) -> Self:
        if self.juegos % 2 == 0:
            raise ValueError("juegos debe ser impar.")
        if len(self.formato) != self.juegos:
            raise ValueError("formato debe contener un booleano por juego.")
        return self


# Localiza una celda de la tabla F por victorias restantes de A y B.
class CellReference(ContractModel):
    tabla: Literal["F"]
    fila: Index
    columna: Index


# Añade la probabilidad que debe aplicarse a la celda durante la reproducción.
class CellChange(CellReference):
    valor: Probability


# Identifica un estado ya calculado y su probabilidad.
class Dependency(ContractModel):
    fila: Index
    columna: Index
    valor: Probability


# Expone la localía y las dos alternativas usadas para evaluar un estado.
class EvaluationData(ContractModel):
    juego: Annotated[int, Field(ge=1, le=11)]
    localA: bool
    probabilidadVictoriaA: Probability
    probabilidadVictoriaB: Probability
    siGanaA: Dependency
    siGanaB: Dependency
    valorCalculado: Probability


# Describe un evento de cálculo y los cambios que aplica a la tabla F.
class Step(ContractModel):
    orden: Annotated[int, Field(ge=1)]
    tipo: Literal["inicializacion", "evaluacion", "actualizacion", "resultado"]
    explicacion: str
    foco: CellReference | None
    cambios: list[CellChange]
    datos: EvaluationData | None = None


# Resume las probabilidades finales de ambos equipos y la meta de victorias.
class Result(ContractModel):
    probabilidadA: Probability
    probabilidadB: Probability
    victoriasNecesarias: Annotated[int, Field(ge=1, le=6)]
    conclusion: str


# Contiene la tabla final de probabilidades de victoria de A.
class Tables(ContractModel):
    F: list[list[Probability]]


# Define los ejes de victorias restantes y su indexación desde cero.
class Metadata(ContractModel):
    ejeFilas: Literal["victoriasRestantesA"]
    ejeColumnas: Literal["victoriasRestantesB"]
    indicesDesde: Literal[0]


# Agrupa resultado, tabla, pasos y metadatos de la serie.
class SeriesResponse(ContractModel):
    algoritmo: Literal["series-deportivas"]
    resultado: Result
    tablas: Tables
    pasos: list[Step]
    metadatos: Metadata
