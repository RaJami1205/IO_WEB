import { describe, expect, it } from "vitest";
import { validarConfiguracion } from "../componentes/SeriesDeportivas";

describe("Series Deportivas: validación de entrada", () => {
  const datos = {
    algoritmo: "series-deportivas",
    juegos: 3,
    ph: 0.65,
    pr: 0.45,
    formato: [true, false, true],
  };

  it("acepta una serie válida de tres juegos", () => {
    expect(validarConfiguracion(datos)).toEqual(datos);
  });

  it("rechaza juegos pares y más de once juegos", () => {
    expect(() => validarConfiguracion({ ...datos, juegos: 4 })).toThrow(
      /impar/i,
    );
    expect(() => validarConfiguracion({ ...datos, juegos: 13 })).toThrow(
      /entre 1 y 11/i,
    );
  });

  it("rechaza probabilidades inválidas y localías incompletas", () => {
    expect(() => validarConfiguracion({ ...datos, ph: 1.2 })).toThrow(/ph/i);
    expect(() => validarConfiguracion({ ...datos, pr: -0.1 })).toThrow(/pr/i);
    expect(() =>
      validarConfiguracion({ ...datos, formato: [true, false] }),
    ).toThrow(/formato/i);
  });
});
