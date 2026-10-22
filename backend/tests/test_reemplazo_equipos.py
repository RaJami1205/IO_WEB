from fractions import Fraction
from itertools import product

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.algoritmos.reemplazo_equipos.schemas import ReplacementRequest
from app.algoritmos.reemplazo_equipos.service import solve_replacement
from app.algoritmos.reemplazo_equipos.solver import solve
from app.main import create_app


def data(initial=500, horizon=5, periods=((400, 30), (300, 40), (250, 60))):
    return {"algoritmo": "reemplazo-equipos", "costoInicial": initial,
            "plazo": horizon, "vidaUtil": len(periods),
            "periodos": [{"reventa": r, "mantenimiento": m} for r, m in periods]}


def response(body, offset=0, limit=100):
    return solve_replacement(ReplacementRequest.model_validate(body), offset, limit).model_dump(exclude_unset=True)


@pytest.fixture
def client():
    with TestClient(create_app()) as client:
        yield client


def test_official_derived_example():
    result = response(data())
    assert result["tablas"] == {
        "costosPorDuracion": [130, 270, 380], "G": [640, 510, 380, 260, 130, 0],
        "siguientes": [[1, 3], [2, 4], [5], [4], [5], []],
    }
    assert result["resultado"]["costoMinimo"] == 640
    assert result["resultado"]["cantidadPlanesOptimos"] == 3
    assert result["resultado"]["planesOptimos"] == [[0, 1, 2, 5], [0, 1, 4, 5], [0, 3, 4, 5]]
    assert len(result["pasos"]) == 26


def test_handwritten_class_exercise():
    result = response(data(15000, 7, ((11000, 800), (8500, 1300), (6000, 2100), (3500, 3000))))
    assert result["tablas"] == {
        "costosPorDuracion": [4800, 8600, 13200, 18700],
        "G": [30400, 25800, 21800, 17200, 13200, 8600, 4800, 0],
        "siguientes": [[2, 3], [3], [4, 5], [5], [7], [7], [7], []],
    }
    assert result["resultado"]["costoMinimo"] == 30400
    assert result["resultado"]["cantidadPlanesOptimos"] == 3
    assert result["resultado"]["planesOptimos"] == [[0, 2, 4, 7], [0, 2, 5, 7], [0, 3, 5, 7]]


@pytest.mark.parametrize("periods", [((3, 1),), ((3, 1), (1, 2), (0, 4))])
def test_one_period_and_life_exceeds_horizon(periods):
    result = response(data(5, 1, periods))
    assert result["resultado"]["costoMinimo"] == 3
    assert result["resultado"]["planesOptimos"] == [[0, 1]]
    assert len(result["tablas"]["costosPorDuracion"]) == len(periods)


def test_exact_decimal_ties_and_negative_costs():
    solution = solve(0.1, 2, [(0, 0.2), (0.1, 0.4)])
    assert solution.costos == [Fraction('0.3'), Fraction('0.6')]
    assert solution.G[0] == Fraction('0.6')
    assert solution.planes == [[0, 1, 2], [0, 2]]
    assert response(data(-1, 2, ((2, -3),)))["resultado"]["costoMinimo"] == -12


def test_pagination_and_large_offsets():
    body = data(0, 7, ((0, 0),) * 3)
    complete = response(body)["resultado"]
    plans = complete["planesOptimos"]
    paged = []
    for offset in range(0, len(plans), 5):
        page = response(body, offset, 5)["resultado"]
        assert page["cantidadPlanesOptimos"] == len(plans)
        assert page["paginacion"] == {"offset": offset, "limite": 5,
                                     "devueltos": min(5, len(plans) - offset),
                                     "hayMas": offset + 5 < len(plans)}
        paged.extend(page["planesOptimos"])
    assert paged == plans == sorted(plans)
    assert len(set(map(tuple, paged))) == len(paged)
    for offset in [len(plans), len(plans) + 10, 10**50]:
        page = response(body, offset)["resultado"]
        assert page["planesOptimos"] == []
        assert page["paginacion"]["hayMas"] is False


def test_531372800_plans_with_first_and_last_pages():
    body = data(0, 30, ((0, 0),) * 10)
    first = response(body)["resultado"]
    assert first["cantidadPlanesOptimos"] == 531372800
    assert len(first["planesOptimos"]) == 100
    assert first["planesOptimos"][0] == list(range(31))
    assert first["paginacion"]["hayMas"] is True
    last = response(body, 531372798)["resultado"]
    assert last["planesOptimos"] == [[0, 10, 20, 29, 30], [0, 10, 20, 30]]
    assert last["paginacion"]["hayMas"] is False


@pytest.mark.parametrize("horizon,life", [(1, 3), (5, 3), (7, 4), (30, 10)])
def test_event_order_references_and_exact_replay(horizon, life):
    result = response(data(5, horizon, tuple((d, d / 10) for d in range(life))))
    pending = {"costosPorDuracion": [None] * life, "G": [None] * (horizon + 1),
               "siguientes": [None] * (horizon + 1)}
    events = result["pasos"]
    expected_types = ["inicializacion"] + ["evaluacion", "actualizacion"] * life
    for t in range(horizon - 1, -1, -1):
        expected_types += ["evaluacion"] * min(life, horizon - t) + ["actualizacion"]
    expected_types += ["reconstruccion", "resultado"]
    assert [e["tipo"] for e in events] == expected_types
    assert len(events) == 2 * life + sum(min(life, horizon - t) for t in range(horizon)) + horizon + 3
    for order, event in enumerate(events, 1):
        assert event["orden"] == order
        if event["foco"]:
            ref = event["foco"]
            assert 0 <= ref["indice"] < len(pending[ref["tabla"]])
        if event["tipo"] in {"evaluacion", "reconstruccion", "resultado"}:
            assert event["cambios"] == []
        if event["tipo"] == "evaluacion" and event["datos"]["etapa"] == "estado":
            details = event["datos"]
            assert pending["G"][details["siguiente"]] == details["costoFuturo"]
            assert pending["costosPorDuracion"][details["duracion"] - 1] == details["costoDuracion"]
            old, new = details["minimoParcialAnterior"], details["costoCandidato"]
            decision = "nuevoMinimo" if old is None or new < old else "empate" if new == old else "descartado"
            assert details["decision"] == decision
        for change in event["cambios"]:
            target = pending[change["tabla"]]
            assert 0 <= change["indice"] < len(target)
            assert target[change["indice"]] is None
            target[change["indice"]] = change["valor"]
    assert pending == result["tablas"]
    assert events[-1]["explicacion"] == result["resultado"]["conclusion"]
    assert events[-1]["foco"] == {"tabla": "G", "indice": 0}


def test_brute_force_small_cases_and_all_plan_costs():
    for horizon in range(1, 6):
        for costs in product([-1, 0, 2], repeat=3):
            # Con adquisición/mantenimiento cero, reventa = -C(d).
            solution = solve(0, horizon, [(-c, 0) for c in costs])
            all_plans = []

            def enumerate_paths(path, cost):
                if path[-1] == horizon:
                    all_plans.append((cost, path))
                    return
                for d in range(1, min(3, horizon - path[-1]) + 1):
                    enumerate_paths([*path, path[-1] + d], cost + costs[d - 1])

            enumerate_paths([0], 0)
            minimum = min(cost for cost, _ in all_plans)
            optimum = [plan for cost, plan in all_plans if cost == minimum]
            assert solution.G[0] == minimum
            assert solution.conteos[0] == len(optimum)
            assert solution.planes == optimum
            for plan in solution.planes:
                assert sum(solution.costos[b - a - 1] for a, b in zip(plan, plan[1:])) == solution.G[0]


@pytest.mark.parametrize("field,value", [
    ("plazo", 0), ("plazo", 31), ("plazo", True), ("plazo", 5.0), ("plazo", "5"),
    ("vidaUtil", 0), ("vidaUtil", 11), ("vidaUtil", False),
    ("periodos", []), ("periodos", {}), ("periodos", [None] * 3),
    ("costoInicial", True), ("costoInicial", "500"), ("costoInicial", None),
    ("algoritmo", "series-deportivas"), ("extra", 1),
])
def test_invalid_input(client, field, value):
    assert client.post('/api/reemplazo-equipos', json={**data(), field: value}).status_code == 422


@pytest.mark.parametrize("field", ["reventa", "mantenimiento"])
@pytest.mark.parametrize("value", [True, "30", None, [], float('nan'), float('inf'), -float('inf')])
def test_invalid_period_numbers(field, value):
    body = data()
    body["periodos"][0][field] = value
    with pytest.raises(ValidationError):
        ReplacementRequest.model_validate(body)


@pytest.mark.parametrize("value", [float('nan'), float('inf'), -float('inf')])
def test_nonfinite_initial(value):
    with pytest.raises(ValidationError):
        ReplacementRequest.model_validate(data(initial=value))


@pytest.mark.parametrize("query", ["offset=-1", "offset=x", "offset=1.5", "limite=0", "limite=101", "limite=true"])
def test_invalid_pagination(client, query):
    assert client.post('/api/reemplazo-equipos?' + query, json=data()).status_code == 422


def test_http_contract_numeric_serialization(client):
    result = client.post('/api/reemplazo-equipos?offset=1&limite=1', json=data())
    assert result.status_code == 200
    body = result.json()
    assert set(body) == {"algoritmo", "resultado", "tablas", "pasos", "metadatos"}
    assert body["resultado"]["planesOptimos"] == [[0, 1, 4, 5]]
    assert body["metadatos"] == {"instanteInicial": 0, "instanteFinal": 5,
                                 "costosIndexadosDesde": 1, "planesIncluyenInicioFin": True}
    result = client.post('/api/reemplazo-equipos', json=data(0.1, 2, ((0, 0.2), (0.1, 0.4))))
    assert result.status_code == 200
    body = result.json()
    assert body["resultado"]["costoMinimo"] == 0.6
    assert body["tablas"]["costosPorDuracion"] == [0.3, 0.6]
    for step in body["pasos"]:
        for change in step["cambios"]:
            if change["tabla"] != 'siguientes':
                assert type(change["valor"]) in (int, float)
    assert body["resultado"]["cantidadPlanesOptimos"] == 2


@pytest.mark.parametrize("token", ["NaN", "Infinity", "-Infinity"])
def test_nonfinite_http_rejected(client, token):
    import json

    raw = json.dumps(data()).replace('"costoInicial": 500', '"costoInicial": ' + token)
    assert client.post('/api/reemplazo-equipos', content=raw,
                       headers={"Content-Type": "application/json"}).status_code == 422


def test_http_decimal_tokens_preserve_decisions(client):
    raw = ('{"algoritmo":"reemplazo-equipos","costoInicial":0,"plazo":2,"vidaUtil":2,'
           '"periodos":[{"reventa":0,"mantenimiento":0.10000000000000001},'
           '{"reventa":0,"mantenimiento":0.1}]}')
    result = client.post('/api/reemplazo-equipos', content=raw,
                         headers={"Content-Type": "application/json"})
    assert result.status_code == 200
    assert result.json()["resultado"]["planesOptimos"] == [[0, 2]]
    assert result.json()["resultado"]["cantidadPlanesOptimos"] == 1


def test_large_finite_decimal_serializes_as_integer(client):
    raw = ('{"algoritmo":"reemplazo-equipos","costoInicial":1e999,"plazo":1,"vidaUtil":1,'
           '"periodos":[{"reventa":0,"mantenimiento":0}]}')
    result = client.post('/api/reemplazo-equipos', content=raw,
                         headers={"Content-Type": "application/json"})
    assert result.status_code == 200
    assert result.json()["resultado"]["costoMinimo"] == 10**999


def test_serialization_rejects_fractional_overflow():
    from app.algoritmos.reemplazo_equipos.service import json_numbers

    with pytest.raises(ValueError):
        json_numbers(Fraction(10**400) + Fraction(1, 10))


def test_nested_extra_and_malformed_json(client):
    body = data()
    body["periodos"][0]["extra"] = 1
    assert client.post('/api/reemplazo-equipos', json=body).status_code == 422
    assert client.post('/api/reemplazo-equipos', content='{',
                       headers={"Content-Type": "application/json"}).status_code == 422
