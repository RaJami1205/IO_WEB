from dataclasses import dataclass
from decimal import Decimal
from fractions import Fraction
from typing import Any


@dataclass
class Solution:
    costos: list[Fraction]
    G: list[Fraction]
    siguientes: list[list[int]]
    conteos: list[int]
    planes: list[list[int]]
    pasos: list[dict[str, Any]]


def page_plans(siguientes: list[list[int]], counts: list[int], offset: int, limit: int) -> list[list[int]]:
    """DFS ordenado: descarta subárboles enteros usando su número de hojas."""
    plans: list[list[int]] = []
    terminal = len(siguientes) - 1

    def visit(path: list[int], skip: int) -> None:
        if len(plans) >= limit:
            return
        t = path[-1]
        if t == terminal:
            plans.append(path.copy())
            return
        for following in siguientes[t]:
            if len(plans) >= limit:
                break
            if skip >= counts[following]:
                skip -= counts[following]
            else:
                visit([*path, following], skip)
                skip = 0

    if offset < counts[0]:
        visit([0], offset)
    return plans


def solve(initial: int | float | Decimal, horizon: int,
          periods: list[tuple[int | float | Decimal, int | float | Decimal]],
          offset: int = 0, limit: int = 100) -> Solution:
    """Entradas validadas. Fraction(str(n)) conserva exactamente el decimal recibido."""
    acquisition = Fraction(str(initial))
    resale = [Fraction(str(r)) for r, _ in periods]
    maintenance = [Fraction(str(m)) for _, m in periods]
    life = len(periods)
    costs: list[Fraction] = []
    values = [Fraction(0)] * (horizon + 1)
    following: list[list[int]] = [[] for _ in range(horizon + 1)]
    counts = [0] * (horizon + 1)
    counts[horizon] = 1
    events: list[dict[str, Any]] = []

    def event(kind, explanation, focus=None, changes=None, data=None):
        item = {"orden": len(events) + 1, "tipo": kind, "explicacion": explanation,
                "foco": focus, "cambios": [] if changes is None else changes}
        if data is not None:
            item["datos"] = data
        events.append(item)

    event("inicializacion", "Al finalizar el horizonte, G(T)=0 y no quedan decisiones.", changes=[
        {"tabla": "G", "indice": horizon, "valor": Fraction(0)},
        {"tabla": "siguientes", "indice": horizon, "valor": []},
    ])
    accumulated = Fraction(0)
    for d in range(1, life + 1):
        accumulated += maintenance[d - 1]
        cost = acquisition + accumulated - resale[d - 1]
        focus = {"tabla": "costosPorDuracion", "indice": d - 1}
        event("evaluacion", f"C({d}) = adquisición + mantenimientos acumulados − reventa.", focus, data={
            "etapa": "costoDuracion", "duracion": d, "costoInicial": acquisition,
            "mantenimientos": maintenance[:d], "sumaMantenimiento": accumulated,
            "reventa": resale[d - 1], "costoCalculado": cost,
        })
        costs.append(cost)
        event("actualizacion", f"Se guarda el costo de utilizar el equipo durante {d} períodos.",
              focus, [{**focus, "valor": cost}])

    for t in range(horizon - 1, -1, -1):
        best = None
        decisions: list[int] = []
        focus = {"tabla": "G", "indice": t}
        for d in range(1, min(life, horizon - t) + 1):
            candidate = costs[d - 1] + values[t + d]
            previous = best
            if best is None or candidate < best:
                decision = "nuevoMinimo"
                best, decisions = candidate, [t + d]
            elif candidate == best:
                decision = "empate"
                decisions.append(t + d)
            else:
                decision = "descartado"
            event("evaluacion", f"Se compara C({d}) + G({t + d}) con el mínimo parcial: {decision}.",
                  focus, data={
                      "etapa": "estado", "instante": t, "duracion": d, "siguiente": t + d,
                      "costoDuracion": costs[d - 1], "costoFuturo": values[t + d],
                      "costoCandidato": candidate, "minimoParcialAnterior": previous,
                      "minimoParcial": best, "decision": decision,
                  })
        values[t] = best
        following[t] = decisions
        counts[t] = sum(counts[s] for s in decisions)
        event("actualizacion", f"Se guardan G({t}) y todas sus decisiones óptimas conjuntamente.", focus, [
            {"tabla": "G", "indice": t, "valor": best},
            {"tabla": "siguientes", "indice": t, "valor": decisions.copy()},
        ])
    plans = page_plans(following, counts, offset, limit)
    event("reconstruccion", "Desde 0 se recorren las decisiones óptimas en orden ascendente; "
          "los conteos permiten saltar ramas para obtener la página. El instante final no es otro reemplazo.",
          data={"instanteInicial": 0, "instanteFinal": horizon, "cantidadPlanesOptimos": counts[0]})
    return Solution(costs, values, following, counts, plans, events)
