import { describe, expect, it } from "vitest";
import { validarConfiguracion } from "../componentes/RemplazoEquipos";

describe("Reemplazo de Equipos: validación de entrada", () => {
  const datos = {
    algoritmo: "reemplazo-equipos",
    costoInicial: 500,
    plazo: 5,
    vidaUtil: 3,
    periodos: [
      { reventa: 400, mantenimiento: 30 },
      { reventa: 300, mantenimiento: 40 },
      { reventa: 250, mantenimiento: 60 },
    ],
  };

  it("acepta períodos que corresponden con la vida útil", () => {
    expect(validarConfiguracion(datos)).toEqual(datos);
  });

  it("rechaza períodos incompletos", () => {
    expect(() =>
      validarConfiguracion({
        ...datos,
        periodos: datos.periodos.slice(0, 2),
      }),
    ).toThrow(/período/i);
  });

  it("rechaza costos negativos y plazos decimales", () => {
    expect(() => validarConfiguracion({ ...datos, costoInicial: -1 })).toThrow(
      /costo inicial/i,
    );
    expect(() => validarConfiguracion({ ...datos, plazo: 2.5 })).toThrow(
      /plazo/i,
    );
  });
});
