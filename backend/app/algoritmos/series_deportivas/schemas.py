from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

Probability = Annotated[float, Field(ge=0, le=1, allow_inf_nan=False)]
Index = Annotated[int, Field(ge=0)]


class ContractModel(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")


class SeriesRequest(ContractModel):
    algoritmo: Literal["series-deportivas"]
    juegos: Annotated[int, Field(ge=1, le=11)]
    ph: Probability
    pr: Probability
    formato: list[bool]

    @model_validator(mode="after")
    def validate_series(self) -> Self:
        if self.juegos % 2 == 0:
            raise ValueError("juegos debe ser impar.")
        if len(self.formato) != self.juegos:
            raise ValueError("formato debe contener un booleano por juego.")
        return self


class CellReference(ContractModel):
    tabla: Literal["F"]
    fila: Index
    columna: Index


class CellChange(CellReference):
    valor: Probability


class Dependency(ContractModel):
    fila: Index
    columna: Index
    valor: Probability


class EvaluationData(ContractModel):
    juego: Annotated[int, Field(ge=1, le=11)]
    localA: bool
    probabilidadVictoriaA: Probability
    probabilidadVictoriaB: Probability
    siGanaA: Dependency
    siGanaB: Dependency
    valorCalculado: Probability


class Step(ContractModel):
    orden: Annotated[int, Field(ge=1)]
    tipo: Literal["inicializacion", "evaluacion", "actualizacion", "resultado"]
    explicacion: str
    foco: CellReference | None
    cambios: list[CellChange]
    datos: EvaluationData | None = None


class Result(ContractModel):
    probabilidadA: Probability
    probabilidadB: Probability
    victoriasNecesarias: Annotated[int, Field(ge=1, le=6)]
    conclusion: str


class Tables(ContractModel):
    F: list[list[Probability]]


class Metadata(ContractModel):
    ejeFilas: Literal["victoriasRestantesA"]
    ejeColumnas: Literal["victoriasRestantesB"]
    indicesDesde: Literal[0]


class SeriesResponse(ContractModel):
    algoritmo: Literal["series-deportivas"]
    resultado: Result
    tablas: Tables
    pasos: list[Step]
    metadatos: Metadata
