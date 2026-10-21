from app.algoritmos.series_deportivas.schemas import SeriesRequest, SeriesResponse
from app.algoritmos.series_deportivas.solver import solve


def solve_series(request: SeriesRequest) -> SeriesResponse:
    solution = solve(request.juegos, request.ph, request.pr, request.formato)
    k = solution.victorias_necesarias
    probability_a = solution.tabla[k][k]
    return SeriesResponse.model_validate({
        "algoritmo": "series-deportivas",
        "resultado": {
            "probabilidadA": probability_a,
            "probabilidadB": 1 - probability_a,
            "victoriasNecesarias": k,
            "conclusion": solution.conclusion,
        },
        "tablas": {"F": solution.tabla},
        "pasos": solution.pasos,
        "metadatos": {
            "ejeFilas": "victoriasRestantesA",
            "ejeColumnas": "victoriasRestantesB",
            "indicesDesde": 0,
        },
    })
