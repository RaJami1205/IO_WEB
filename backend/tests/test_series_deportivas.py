from itertools import product
from math import prod

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.algoritmos.series_deportivas.schemas import SeriesRequest, SeriesResponse
from app.algoritmos.series_deportivas.solver import solve
from app.main import create_app


def payload(**changes):
    return {
        "algoritmo": "series-deportivas", "juegos": 3,
        "ph": 0.7, "pr": 0.7, "formato": [True, False, True], **changes,
    }


@pytest.fixture
def client(monkeypatch):
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    with TestClient(create_app()) as client:
        yield client


@pytest.mark.parametrize("juegos,expected", [(7, 0.873964), (5, 0.83692)])
def test_quiz_6_references(juegos, expected):
    """Los dos ejercicios reales del Quiz 6 aportados en CODEX-006."""
    solution = solve(juegos, 0.7, 0.7, [True] * juegos)
    k = solution.victorias_necesarias
    assert solution.tabla[k][k] == pytest.approx(expected)
    if juegos == 5:
        assert 1 - solution.tabla[k][k] == pytest.approx(0.16308)


def test_official_json_derived_reference():
    """Referencia derivada del JSON oficial; no es un ejercicio de clase."""
    solution = solve(7, 0.58, 0.45, [True, True, False, False, False, True, True])
    assert solution.tabla[4][4] == pytest.approx(0.5534887684)
    assert 1 - solution.tabla[4][4] == pytest.approx(0.4465112316)


def test_three_game_matrix():
    solution = solve(3, 0.7, 0.7, [True, False, True])
    for actual, expected in zip(solution.tabla, [[0, 1, 1], [0, 0.7, 0.91], [0, 0.49, 0.784]]):
        assert actual == pytest.approx(expected)
    assert "78.40 %" in solution.conclusion
    assert "21.60 %" in solution.conclusion


@pytest.mark.parametrize("local,expected", [(True, 0.58), (False, 0.45)])
def test_one_game(local, expected):
    assert solve(1, 0.58, 0.45, [local]).tabla[1][1] == expected


@pytest.mark.parametrize("p", [0.0, 1.0])
def test_extreme_probabilities(p):
    assert solve(11, p, p, [False] * 11).tabla[6][6] == p


@pytest.mark.parametrize("juegos", [1, 3, 5, 7, 9, 11])
def test_against_independent_outcome_enumeration(juegos):
    """Oráculo por enumeración de resultados, independiente de la recurrencia DP."""
    formato = [g % 3 == 0 for g in range(juegos)]
    probabilities = [0.58 if local else 0.45 for local in formato]
    k = (juegos + 1) // 2
    expected = sum(
        prod(p if win else 1 - p for win, p in zip(outcomes, probabilities))
        for outcomes in product([False, True], repeat=juegos)
        if sum(outcomes) >= k
    )
    assert solve(juegos, 0.58, 0.45, formato).tabla[k][k] == pytest.approx(expected)


@pytest.mark.parametrize("changes", [
    {"algoritmo": "mochila"}, {"juegos": 2}, {"juegos": 0}, {"juegos": 13},
    {"juegos": True}, {"juegos": 3.0}, {"juegos": "3"},
    {"formato": [True]}, {"formato": [1, 0, 1]},
    {"formato": ["true", False, True]}, {"formato": None},
    {"ph": -0.1}, {"pr": 1.1}, {"ph": "0.7"}, {"pr": True},
    {"ph": None}, {"extra": 1},
])
def test_invalid_requests_return_422(client, changes):
    assert client.post("/api/series-deportivas", json=payload(**changes)).status_code == 422


@pytest.mark.parametrize("field", ["ph", "pr"])
@pytest.mark.parametrize("value", [float("nan"), float("inf"), -float("inf")])
def test_nonfinite_probabilities_rejected(field, value):
    with pytest.raises(ValidationError):
        SeriesRequest.model_validate(payload(**{field: value}))


def test_missing_field_rejected(client):
    data = payload()
    del data["algoritmo"]
    assert client.post("/api/series-deportivas", json=data).status_code == 422


def test_integer_probability_endpoints_accepted(client):
    response = client.post("/api/series-deportivas", json=payload(ph=1, pr=0))
    assert response.status_code == 200
    assert response.json()["resultado"]["probabilidadA"] == 1


def test_response_contract_and_openapi(client):
    response = client.post("/api/series-deportivas", json=payload())
    assert response.status_code == 200
    data = response.json()
    SeriesResponse.model_validate(data)
    assert set(data) == {"algoritmo", "resultado", "tablas", "pasos", "metadatos"}
    assert data["algoritmo"] == "series-deportivas"
    assert set(data["resultado"]) == {
        "probabilidadA", "probabilidadB", "victoriasNecesarias", "conclusion",
    }
    assert data["resultado"]["probabilidadA"] == pytest.approx(0.784)
    assert data["resultado"]["probabilidadB"] == pytest.approx(0.216)
    assert data["resultado"]["victoriasNecesarias"] == 2
    assert set(data["tablas"]) == {"F"}
    assert data["metadatos"] == {
        "ejeFilas": "victoriasRestantesA", "ejeColumnas": "victoriasRestantesB", "indicesDesde": 0,
    }
    for step in data["pasos"]:
        expected = {"orden", "tipo", "explicacion", "foco", "cambios"}
        if step["tipo"] == "evaluacion":
            expected.add("datos")
            assert set(step["datos"]) == {
                "juego", "localA", "probabilidadVictoriaA", "probabilidadVictoriaB",
                "siGanaA", "siGanaB", "valorCalculado",
            }
        assert set(step) == expected
    assert data["pasos"][0]["foco"] is None
    document = client.get("/openapi.json").json()
    operation = document["paths"]["/api/series-deportivas"]["post"]
    assert operation["responses"]["200"]["content"]["application/json"]["schema"]["$ref"].endswith("/SeriesResponse")


@pytest.mark.parametrize("juegos", [1, 3, 5, 7, 9, 11])
def test_trace_reconstruction_and_dependencies(juegos):
    formato = [g % 2 == 0 for g in range(juegos)]
    solution = solve(juegos, 0.58, 0.45, formato)
    k = solution.victorias_necesarias
    assert len(solution.tabla) == k + 1
    assert all(len(row) == k + 1 for row in solution.tabla)
    assert solution.tabla[0] == [0] + [1] * k
    assert [row[0] for row in solution.tabla] == [0] * (k + 1)
    events = solution.pasos
    assert len(events) == 2 * k * k + 2
    assert [event["orden"] for event in events] == list(range(1, len(events) + 1))
    assert [event["tipo"] for event in events] == ["inicializacion"] + ["evaluacion", "actualizacion"] * (k * k) + ["resultado"]
    assert len(events[0]["cambios"]) == 2 * k + 1
    pending = [[None] * (k + 1) for _ in range(k + 1)]
    evaluated = []
    for event in events:
        focus = event["foco"]
        if focus is not None:
            assert focus["tabla"] == "F"
            assert 0 <= focus["fila"] <= k and 0 <= focus["columna"] <= k
        if event["tipo"] == "evaluacion":
            i, j = focus["fila"], focus["columna"]
            evaluated.append((i, j))
            assert pending[i][j] is None
            assert event["cambios"] == []
            details = event["datos"]
            g = 2 * k - i - j
            assert details["juego"] == g + 1
            assert details["localA"] is formato[g]
            p = 0.58 if formato[g] else 0.45
            assert details["probabilidadVictoriaA"] == p
            assert details["probabilidadVictoriaB"] == 1 - p
            for key, row, col in [("siGanaA", i - 1, j), ("siGanaB", i, j - 1)]:
                assert pending[row][col] is not None
                assert details[key] == {"fila": row, "columna": col, "valor": pending[row][col]}
            assert details["valorCalculado"] == solution.tabla[i][j]
        if event["tipo"] == "actualizacion":
            assert len(event["cambios"]) == 1
            assert event["cambios"][0] == {**focus, "valor": solution.tabla[focus["fila"]][focus["columna"]]}
        for change in event["cambios"]:
            assert change["tabla"] == "F"
            i, j = change["fila"], change["columna"]
            assert 0 <= i <= k and 0 <= j <= k
            assert pending[i][j] is None  # Ninguna posición se inicializa o escribe dos veces.
            pending[i][j] = change["valor"]
    assert evaluated == [(i, j) for i in range(1, k + 1) for j in range(1, k + 1)]
    assert pending == solution.tabla  # Reproducción exacta, sin ejecutar la recurrencia.
    assert events[-1]["foco"] == {"tabla": "F", "fila": k, "columna": k}
    assert events[-1]["cambios"] == []
    assert events[-1]["explicacion"] == solution.conclusion
