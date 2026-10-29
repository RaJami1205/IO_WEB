
# Alias de tipo: una tabla n x n cuyas celdas pueden estar vacías (None)
# mientras no hayan sido calculadas.
Tabla = list[list[int | None]]

# Crea una tabla de tamaño n × n con valores None.
def crear_tabla_vacia(n: int) -> Tabla:

    return [[None for _ in range(n)] for _ in range(n)]

#Coloca ceros en la diagonal principal de M.
def inicializar_diagonal(M: Tabla, n: int) -> None:

    for i in range(n):
        M[i][i] = 0

#Calcula el costo de multiplicar una cadena utilizando un corte específico.
def calcular_costo_corte(
    M: Tabla,
    dimensiones: list[int],
    i: int,
    k: int,
    j: int,
) -> int:

    costo_izquierdo = M[i][k]
    costo_derecho = M[k + 1][j]

    # Los subproblemas más cortos se resuelven antes, por lo que
    # estas celdas nunca deberían estar vacías.
    assert costo_izquierdo is not None
    assert costo_derecho is not None

    costo_unir = (
        dimensiones[i]
        * dimensiones[k + 1]
        * dimensiones[j + 1]
    )

    return costo_izquierdo + costo_derecho + costo_unir

	#Prueba todos los cortes posibles y selecciona el de menor costo.
def buscar_mejor_corte(
    M: Tabla,
    dimensiones: list[int],
    i: int,
    j: int,
) -> tuple[int, int]:

    mejor_costo = None
    mejor_corte = None

    for k in range(i, j):
        costo = calcular_costo_corte(M, dimensiones, i, k, j)

        if mejor_costo is None or costo < mejor_costo:
            mejor_costo = costo
            mejor_corte = k + 1

    assert mejor_costo is not None
    assert mejor_corte is not None

    return mejor_costo, mejor_corte


#	Resuelve los subproblemas y llena las tablas M y P.
def llenar_tablas(
    M: Tabla,
    P: Tabla,
    dimensiones: list[int],
    n: int,
) -> None:

    for largo in range(2, n + 1):
        for i in range(n - largo + 1):
            j = i + largo - 1

            mejor_costo, mejor_corte = buscar_mejor_corte(
                M, dimensiones, i, j
            )

            M[i][j] = mejor_costo
            P[i][j] = mejor_corte




#Reconstruye recursivamente el orden óptimo de multiplicación.
def construir_parentizacion(P: Tabla, i: int, j: int) -> str:

    if i == j:
        return f"A{i + 1}"

    corte = P[i][j]
    assert corte is not None

    izquierda = construir_parentizacion(P, i, corte - 1)
    derecha = construir_parentizacion(P, corte, j)

    return f"({izquierda} × {derecha})"



# Punto de entrada


def solve(dimensiones: list[int]):

    n = len(dimensiones) - 1

    # 1. Preparar tablas y caso base
    M = crear_tabla_vacia(n)
    P = crear_tabla_vacia(n)
    inicializar_diagonal(M, n)

    # 2. Resolver todos los subproblemas
    llenar_tablas(M, P, dimensiones, n)

    # 3. Extraer el resultado final
    costo_minimo = M[0][n - 1]
    assert costo_minimo is not None

    parentizacion = construir_parentizacion(P, 0, n - 1)

    return M, P, costo_minimo, parentizacion
