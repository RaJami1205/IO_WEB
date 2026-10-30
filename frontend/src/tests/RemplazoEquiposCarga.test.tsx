// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import RemplazoEquipos from "../componentes/RemplazoEquipos";

afterEach(cleanup);

describe("Reemplazo de Equipos: carga de archivos JSON", () => {
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

  function crearArchivo(contenido: string) {
    const archivo = new File([contenido], "configuracion.json", {
      type: "application/json",
    });

    Object.defineProperty(archivo, "text", {
      value: async () => contenido,
    });

    return archivo;
  }

  it("carga correctamente un archivo JSON válido", async () => {
    render(<RemplazoEquipos />);

    const archivo = crearArchivo(JSON.stringify(datos));

    const input = screen.getByLabelText(/cargar.*json/i) as HTMLInputElement;

    fireEvent.change(input, { target: { files: [archivo] } });

    expect(
      await screen.findByText("Archivo JSON cargado correctamente."),
    ).toBeTruthy();

    expect(
      (screen.getByLabelText("Costo inicial") as HTMLInputElement).value,
    ).toBe("500");

    expect(
      (screen.getByLabelText("Plazo (años)") as HTMLInputElement).value,
    ).toBe("5");

    expect(
      (screen.getByLabelText("Vida útil (años)") as HTMLInputElement).value,
    ).toBe("3");
  });

  it("rechaza un archivo JSON con una estructura inválida", async () => {
    render(<RemplazoEquipos />);

    const archivo = crearArchivo(JSON.stringify([]));

    const input = screen.getByLabelText(/cargar.*json/i) as HTMLInputElement;

    fireEvent.change(input, { target: { files: [archivo] } });

    expect(
      await screen.findByText("El JSON debe contener un objeto."),
    ).toBeTruthy();
  });

  it("rechaza un archivo con períodos incompletos", async () => {
    render(<RemplazoEquipos />);

    const archivo = crearArchivo(
      JSON.stringify({
        ...datos,
        periodos: datos.periodos.slice(0, 2),
      }),
    );

    const input = screen.getByLabelText(/cargar.*json/i) as HTMLInputElement;

    fireEvent.change(input, { target: { files: [archivo] } });

    expect(
      await screen.findByText(
        "Debe haber un período válido por cada año de vida útil.",
      ),
    ).toBeTruthy();
  });
});
