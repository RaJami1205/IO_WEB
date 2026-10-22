import math
from fractions import Fraction

from app.algoritmos.reemplazo_equipos.schemas import ReplacementRequest, ReplacementResponse
from app.algoritmos.reemplazo_equipos.solver import solve


def json_numbers(value):
    """Solo la frontera HTTP convierte fracciones exactas a números JSON finitos."""
    if isinstance(value, Fraction):
        if value.denominator == 1:
            return value.numerator
        try:
            number = float(value)
        except OverflowError as exc:
            raise ValueError("El resultado decimal excede el rango numérico JSON soportado.") from exc
        if not math.isfinite(number) or (number == 0 and value != 0):
            raise ValueError("El resultado decimal excede el rango numérico JSON soportado.")
        return number
    if isinstance(value, list):
        return [json_numbers(item) for item in value]
    if isinstance(value, dict):
        return {key: json_numbers(item) for key, item in value.items()}
    return value


def solve_replacement(request: ReplacementRequest, offset: int, limit: int) -> ReplacementResponse:
    solution = solve(request.costoInicial, request.plazo,
                     [(p.reventa, p.mantenimiento) for p in request.periodos], offset, limit)
    cost = json_numbers(solution.G[0])
    count = solution.conteos[0]
    conclusion = (f"El costo mínimo del proyecto es {cost}. "
                  f"Se identificaron {count} planes óptimos de reemplazo.")
    solution.pasos.append({
        "orden": len(solution.pasos) + 1, "tipo": "resultado", "explicacion": conclusion,
        "foco": {"tabla": "G", "indice": 0}, "cambios": [],
    })
    return ReplacementResponse.model_validate(json_numbers({
        "algoritmo": "reemplazo-equipos",
        "resultado": {
            "costoMinimo": cost, "cantidadPlanesOptimos": count,
            "planesOptimos": solution.planes, "conclusion": conclusion,
            "paginacion": {"offset": offset, "limite": limit, "devueltos": len(solution.planes),
                           "hayMas": offset + len(solution.planes) < count},
        },
        "tablas": {"costosPorDuracion": solution.costos, "G": solution.G,
                   "siguientes": solution.siguientes},
        "pasos": solution.pasos,
        "metadatos": {"instanteInicial": 0, "instanteFinal": request.plazo,
                      "costosIndexadosDesde": 1, "planesIncluyenInicioFin": True},
    }))
