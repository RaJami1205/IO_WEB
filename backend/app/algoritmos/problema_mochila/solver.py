

from dataclasses import dataclass, field
from fractions import Fraction


@dataclass
class Solution:
    tabla_valores: list[list[Fraction]]
    tabla_copias: list[list[int]]
    tabla_opciones: list[list[list[int]]]
    tabla_marcas: list[list[str]]
    copias_elegidas: list[int] = field(default_factory=list)
    hay_empates: bool = False
    pasos: list[dict] = field(default_factory=list)


def formatear_valor(valor: Fraction) -> str:
    return str(valor.numerator) if valor.denominator == 1 else repr(float(valor))


def frase_copias(verbo: str, copias: int) -> str:
    return f"{verbo} 1 copia" if copias == 1 else f"{verbo}n {copias} copias"


def referencia_celda(capacidad: int, objeto: int) -> dict:
    return {"tabla": "V", "fila": capacidad, "columna": objeto}


def cambio_celda(solucion: Solution, capacidad: int, objeto: int) -> dict:
    return {
        **referencia_celda(capacidad, objeto),
        "valor": solucion.tabla_valores[capacidad][objeto],
        "cantidad": solucion.tabla_copias[capacidad][objeto],
        "marca": solucion.tabla_marcas[capacidad][objeto],
    }


def agregar_paso(solucion: Solution, tipo: str, explicacion: str, foco: dict | None,
                 cambios: list[dict], datos: dict | None = None) -> None:
    paso = {"orden": len(solucion.pasos) + 1, "tipo": tipo, "explicacion": explicacion,
            "foco": foco, "cambios": cambios}
    if datos is not None:
        paso["datos"] = datos
    solucion.pasos.append(paso)


def copias_maximas(capacidad: int, peso: int, tope: int | None) -> int:
    copias_que_caben = capacidad // peso
    return copias_que_caben if tope is None else min(tope, copias_que_caben)


def evaluar_celda(solucion: Solution, capacidad: int, objeto: int, peso: int,
                  valor: Fraction, tope: int | None, nombre: str) -> None:
    valores = solucion.tabla_valores
    limite_copias = copias_maximas(capacidad, peso, tope)

    candidatos = []
    for copias in range(limite_copias + 1):
        capacidad_restante = capacidad - copias * peso
        total = copias * valor + valores[capacidad_restante][objeto - 1]
        candidatos.append((copias, capacidad_restante, total))

    mejor_valor = max(total for _, _, total in candidatos)
    # los candidatos van de menor a mayor copias asi el primero empatado es el menor k
    copias_empatadas = [copias for copias, _, total in candidatos if total == mejor_valor]
    copias_elegidas = copias_empatadas[0]
    hay_empate = len(copias_empatadas) > 1

    valores[capacidad][objeto] = mejor_valor
    solucion.tabla_copias[capacidad][objeto] = copias_elegidas
    solucion.tabla_opciones[capacidad][objeto] = copias_empatadas
    solucion.tabla_marcas[capacidad][objeto] = "verde" if copias_elegidas > 0 else "rojo"

    detalle = "; ".join(
        f"k = {copias}: {formatear_valor(copias * valor)} + V({restante},{objeto - 1}) = {formatear_valor(total)}"
        for copias, restante, total in candidatos
    )
    agregar_paso(
        solucion, "evaluacion",
        f"V({capacidad},{objeto}) con {nombre}, se prueban de 0 a {limite_copias} copias. {detalle}.",
        referencia_celda(capacidad, objeto), [],
        {
            "objeto": nombre, "capacidad": capacidad, "maxCopias": limite_copias,
            "candidatos": [
                {"k": copias, "valorObjeto": copias * valor,
                 "celdaPrevia": referencia_celda(restante, objeto - 1), "total": total}
                for copias, restante, total in candidatos
            ],
            "kElegido": copias_elegidas, "empate": hay_empate,
        },
    )

    if copias_elegidas > 0:
        explicacion = (f"{frase_copias('Se lleva', copias_elegidas)} de {nombre}: "
                       f"V({capacidad},{objeto}) = {formatear_valor(mejor_valor)}.")
    else:
        explicacion = (f"No se lleva {nombre}: se copia "
                       f"V({capacidad},{objeto - 1}) = {formatear_valor(mejor_valor)}.")
    if hay_empate:
        explicacion += " Hay empate y se elige el menor k."
    agregar_paso(solucion, "actualizacion", explicacion, referencia_celda(capacidad, objeto),
                 [cambio_celda(solucion, capacidad, objeto)])


def reconstruir(solucion: Solution, capacidad_total: int, pesos: list[int], nombres: list[str]) -> None:
    cantidad_objetos = len(pesos)
    solucion.copias_elegidas = [0] * cantidad_objetos
    capacidad = capacidad_total

    for objeto in range(cantidad_objetos, 0, -1):
        copias = solucion.tabla_copias[capacidad][objeto]
        capacidad_restante = capacidad - copias * pesos[objeto - 1]
        nombre = nombres[objeto - 1]

        solucion.copias_elegidas[objeto - 1] = copias
        if len(solucion.tabla_opciones[capacidad][objeto]) > 1:
            solucion.hay_empates = True

        if copias > 0:
            explicacion = (f"En V({capacidad},{objeto}) {frase_copias('se toma', copias)} de {nombre} "
                           f"y la capacidad baja de {capacidad} a {capacidad_restante}.")
        else:
            explicacion = f"En V({capacidad},{objeto}) no se toma {nombre} y la capacidad sigue en {capacidad}."
        agregar_paso(solucion, "reconstruccion", explicacion, referencia_celda(capacidad, objeto), [], {
            "objeto": nombre, "copias": copias,
            "capacidadAntes": capacidad, "capacidadRestante": capacidad_restante,
        })
        capacidad = capacidad_restante


def solve(capacidad_total: int, pesos: list[int], valores: list[Fraction],
          topes: list[int | None], nombres: list[str]) -> Solution:
    filas = capacidad_total + 1
    columnas = len(pesos) + 1
    solucion = Solution(
        tabla_valores=[[Fraction(0)] * columnas for _ in range(filas)],
        tabla_copias=[[0] * columnas for _ in range(filas)],
        tabla_opciones=[[[0] for _ in range(columnas)] for _ in range(filas)],
        tabla_marcas=[["rojo"] * columnas for _ in range(filas)],
    )

    agregar_paso(solucion, "inicializacion", "Sin objetos el valor es 0 para cualquier capacidad.", None,
                 [cambio_celda(solucion, capacidad, 0) for capacidad in range(filas)])
    agregar_paso(solucion, "inicializacion", "Con capacidad 0 no cabe ningún objeto y el valor es 0.", None,
                 [cambio_celda(solucion, 0, objeto) for objeto in range(1, columnas)])

    # se llena columna por columna porque cada objeto solo depende del anterior
    for objeto in range(1, columnas):
        for capacidad in range(1, filas):
            evaluar_celda(solucion, capacidad, objeto, pesos[objeto - 1], valores[objeto - 1],
                          topes[objeto - 1], nombres[objeto - 1])

    reconstruir(solucion, capacidad_total, pesos, nombres)
    return solucion