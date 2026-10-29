import { describe, expect, it } from "vitest";
import { validarConfiguracion } from "../componentes/MultiplicacionMatrices";

describe("Validación de multiplicación de matrices", () => {
  it("acepta cuatro matrices representadas por cinco dimensiones", () => {
    const datos = validarConfiguracion({
      algoritmo: "multiplicacion-matrices",
      dimensiones: [30, 35, 15, 5, 10],
    });

    expect(datos.dimensiones).toEqual([30, 35, 15, 5, 10]);
    expect(datos.dimensiones.length - 1).toBe(4);
  });

  it("rechaza dimensiones vacías, negativas o decimales", () => {
    expect(() =>
      validarConfiguracion({
        algoritmo: "multiplicacion-matrices",
        dimensiones: [30],
      }),
    ).toThrow(/entre 2 y 11/);

    expect(() =>
      validarConfiguracion({
        algoritmo: "multiplicacion-matrices",
        dimensiones: [30, -5, 10],
      }),
    ).toThrow(/enteros positivos/);

    expect(() =>
      validarConfiguracion({
        algoritmo: "multiplicacion-matrices",
        dimensiones: [30, 3.5, 10],
      }),
    ).toThrow(/enteros positivos/);
  });

  it("rechaza más de diez matrices", () => {
    expect(() =>
      validarConfiguracion({
        algoritmo: "multiplicacion-matrices",
        dimensiones: Array.from({ length: 12 }, () => 10),
      }),
    ).toThrow(/entre 2 y 11/);
  });
});
