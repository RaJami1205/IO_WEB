# Coordina el solver de matrices y construye el resultado y las tablas de la API.
from app.algoritmos.Mult_matrices.schemas import (
    MatricesRequest,
    MatricesResponse,
    ResultadoMatrices,
    TablasMatrices,
)
from app.algoritmos.Mult_matrices.solver import solve


# Redacta el resumen del costo escalar mínimo para la cadena completa.
def construir_conclusion(cantidad_matrices: int, costo_minimo: int) -> str:


    return (
        f"El costo mínimo para multiplicar {cantidad_matrices} matrices "
        f"es {costo_minimo} operaciones escalares."
    )


# Agrupa costo, parentización y conclusión en el modelo de resultado.
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


# Resuelve las dimensiones validadas y devuelve las tablas M y P junto al óptimo.
def resolver_matrices(solicitud: MatricesRequest) -> MatricesResponse:


    M, P, costo_minimo, parentizacion = solve(solicitud.dimensiones)

    cantidad_matrices = len(solicitud.dimensiones) - 1

    return MatricesResponse(
        algoritmo="multiplicacion-matrices",
        resultado=construir_resultado(
            costo_minimo, parentizacion, cantidad_matrices
        ),
        tablas=TablasMatrices(M=M, P=P),
    )
