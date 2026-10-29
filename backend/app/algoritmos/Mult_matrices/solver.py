

# Alias de tipo: una tabla n x n cuyas celdas pueden estar vacías (None)
# mientras no hayan sido calculadas.
Tabla = list[list[int | None]]


# ---------------------------------------------------------------------------
# Paso 1: preparación de las tablas
# ---------------------------------------------------------------------------

def crear_tabla_vacia(n: int) -> Tabla:
    """
    Crea una tabla n x n con todas las celdas .

    Args:
        n: cantidad de matrices de la cadena.

    """
    return [[None for _ in range(n)] for _ in range(n)]


def inicializar_diagonal(M: Tabla, n: int) -> None:
    """
    Caso base: multiplicar una sola matriz no cuesta nada.

    Modifica M en sitio, dejando en 0 la diagonal principal (M[i][i] = 0).

    """
    for i in range(n):
        M[i][i] = 0



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


# ---------------------------------------------------------------------------
# Paso 4: reconstrucción de la parentización óptima
# ---------------------------------------------------------------------------

def construir_parentizacion(P: Tabla, i: int, j: int) -> str:

    if i == j:
        return f"A{i + 1}"

    corte = P[i][j]
    assert corte is not None

    izquierda = construir_parentizacion(P, i, corte - 1)
    derecha = construir_parentizacion(P, corte, j)

    return f"({izquierda} × {derecha})"


# ---------------------------------------------------------------------------
# Punto de entrada
# ---------------------------------------------------------------------------

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
