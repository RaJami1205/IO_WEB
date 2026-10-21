from dataclasses import dataclass
from typing import Literal, NotRequired, TypedDict


class Cell(TypedDict):
    tabla: Literal["F"]
    fila: int
    columna: int


class Change(Cell):
    valor: float


class Dependency(TypedDict):
    fila: int
    columna: int
    valor: float


class Evaluation(TypedDict):
    juego: int
    localA: bool
    probabilidadVictoriaA: float
    probabilidadVictoriaB: float
    siGanaA: Dependency
    siGanaB: Dependency
    valorCalculado: float


class Event(TypedDict):
    orden: int
    tipo: Literal["inicializacion", "evaluacion", "actualizacion", "resultado"]
    explicacion: str
    foco: Cell | None
    cambios: list[Change]
    datos: NotRequired[Evaluation]


@dataclass
class Solution:
    victorias_necesarias: int
    tabla: list[list[float]]
    pasos: list[Event]
    conclusion: str


def solve(juegos: int, ph: float, pr: float, formato: list[bool]) -> Solution:
    """Resuelve datos previamente validados; F usa victorias restantes."""
    k = (juegos + 1) // 2
    table = [[0.0] * (k + 1) for _ in range(k + 1)]
    initial: list[Change] = []
    for j in range(k + 1):
        table[0][j] = 0.0 if j == 0 else 1.0
        initial.append({"tabla": "F", "fila": 0, "columna": j, "valor": table[0][j]})
    for i in range(1, k + 1):
        initial.append({"tabla": "F", "fila": i, "columna": 0, "valor": 0.0})

    events: list[Event] = [{
        "orden": 1, "tipo": "inicializacion",
        "explicacion": (
            "Si A ya no necesita victorias, gana la serie: F(0,j)=1 para j>0. "
            "Si B ya no necesita victorias, A pierde: F(i,0)=0 para i>0. "
            "F(0,0)=0 por convención de presentación."
        ),
        "foco": None, "cambios": initial,
    }]
    for i in range(1, k + 1):
        for j in range(1, k + 1):
            g = 2 * k - i - j
            local = formato[g]
            p = ph if local else pr
            value = p * table[i - 1][j] + (1 - p) * table[i][j - 1]
            focus: Cell = {"tabla": "F", "fila": i, "columna": j}
            events.append({
                "orden": len(events) + 1, "tipo": "evaluacion",
                "explicacion": (
                    f"A necesita {i} victorias y B necesita {j}. En el partido {g + 1}, "
                    f"A juega de {'local' if local else 'visitante'}. "
                    f"F({i},{j}) = {p} × F({i - 1},{j}) + "
                    f"{1 - p} × F({i},{j - 1})."
                ),
                "foco": focus, "cambios": [],
                "datos": {
                    "juego": g + 1, "localA": local,
                    "probabilidadVictoriaA": p, "probabilidadVictoriaB": 1 - p,
                    "siGanaA": {"fila": i - 1, "columna": j, "valor": table[i - 1][j]},
                    "siGanaB": {"fila": i, "columna": j - 1, "valor": table[i][j - 1]},
                    "valorCalculado": value,
                },
            })
            table[i][j] = value
            events.append({
                "orden": len(events) + 1, "tipo": "actualizacion",
                "explicacion": f"Se guarda F({i},{j}) = {value} en la tabla.",
                "foco": focus, "cambios": [{**focus, "valor": value}],
            })

    probability_a = table[k][k]
    conclusion = (
        f"El equipo A tiene un {probability_a * 100:.2f} % de probabilidad de ganar "
        f"la serie y el equipo B un {(1 - probability_a) * 100:.2f} %."
    )
    events.append({
        "orden": len(events) + 1, "tipo": "resultado", "explicacion": conclusion,
        "foco": {"tabla": "F", "fila": k, "columna": k}, "cambios": [],
    })
    return Solution(k, table, events, conclusion)
