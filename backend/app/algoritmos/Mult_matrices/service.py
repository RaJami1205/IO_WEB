

from app.algoritmos.Mult_matrices.schemas import (
    MatricesRequest,
    MatricesResponse,
    ResultadoMatrices,
    TablasMatrices,
)
from app.algoritmos.Mult_matrices.solver import solve


def construir_conclusion(cantidad_matrices: int, costo_minimo: int) -> str:

    return (
        f"El costo mínimo para multiplicar {cantidad_matrices} matrices "
        f"es {costo_minimo} operaciones escalares."
    )


def construir_resultado(
    costo_minimo: int,
    parentizacion: str,
    cantidad_matrices: int,
) -> ResultadoMatrices:

    return ResultadoMatrices(
        costoMinimo=costo_minimo,
        parentizacion=parentizacion,
        conclusion=construir_conclusion(cantidad_matrices, costo_minimo),
    )


def resolver_matrices(solicitud: MatricesRequest) -> MatricesResponse:

    M, P, costo_minimo, parentizacion = solve(solicitud.dimensiones)

    # Con n + 1 dimensiones hay n matrices
    cantidad_matrices = len(solicitud.dimensiones) - 1

    return MatricesResponse(
        algoritmo="multiplicacion-matrices",
        resultado=construir_resultado(
            costo_minimo, parentizacion, cantidad_matrices
        ),
        tablas=TablasMatrices(M=M, P=P),
    )
