import { describe, expect, it } from "vitest";
import { validarConfiguracion } from "../componentes/Mochila";

describe("Mochila: validación de entrada", () => {
  const datos = {
    algoritmo: "mochila",
    variante: "0-1",
    capacidad: 10,
    objetos: [{ nombre: "Agua", peso: 3, valor: 12 }],
  };

  it("acepta una configuración válida", () => {
    expect(validarConfiguracion(datos)).toEqual(datos);
  });

  it("rechaza una capacidad inválida o sin objetos", () => {
    expect(() => validarConfiguracion({ ...datos, capacidad: 21 })).toThrow(/capacidad/i);
    expect(() => validarConfiguracion({ ...datos, objetos: [] })).toThrow(/objetos/i);
  });

  it("exige cantidad en mochila acotada y nombres únicos", () => {
    const acotada = { ...datos, variante: "acotada" };
    expect(() => validarConfiguracion(acotada)).toThrow(/cantidad/i);
    expect(() => validarConfiguracion({
      ...acotada,
      objetos: [
        { nombre: "Agua", peso: 2, valor: 5, cantidad: 1 },
        { nombre: "agua", peso: 3, valor: 7, cantidad: 2 },
      ],
    })).toThrow(/repetido/i);
  });
});
