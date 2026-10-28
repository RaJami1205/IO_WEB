import { describe, expect, it } from "vitest";
import { validarConfiguracion } from "../componentes/ArbolOptimo";

describe("Validación del formulario de ABB óptimo", () => {
  it("acepta llaves desordenadas con pesos reales", () => {
    const datos = validarConfiguracion({
      algoritmo: "abb-optimo",
      llaves: [
        { llave: "while", peso: 12 },
        { llave: "if", peso: 20 },
        { llave: "do", peso: 5.5 },
      ],
    });

    expect(datos.llaves.map((item) => item.llave)).toEqual([
      "while",
      "if",
      "do",
    ]);
  });

  it("rechaza llaves duplicadas", () => {
    expect(() =>
      validarConfiguracion({
        algoritmo: "abb-optimo",
        llaves: [
          { llave: "if", peso: 2 },
          { llave: "if", peso: 4 },
        ],
      }),
    ).toThrow(/repetida/);
  });

  it("rechaza pesos negativos o todos iguales a cero", () => {
    expect(() =>
      validarConfiguracion({
        algoritmo: "abb-optimo",
        llaves: [{ llave: "if", peso: -1 }],
      }),
    ).toThrow(/no negativo/);

    expect(() =>
      validarConfiguracion({
        algoritmo: "abb-optimo",
        llaves: [{ llave: "if", peso: 0 }],
      }),
    ).toThrow(/mayor que cero/);
  });
});
