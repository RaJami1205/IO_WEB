// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import SeriesDeportivas from "../componentes/SeriesDeportivas";

afterEach(cleanup);

describe("Series Deportivas: carga de archivos JSON", () => {
  const datos = {
    algoritmo: "series-deportivas",
    juegos: 3,
    ph: 0.58,
    pr: 0.45,
    formato: [false, true, false],
  };

  function crearArchivo(contenido: string): File {
    const archivo = new File([contenido], "serie.json", {
      type: "application/json",
    });

    Object.defineProperty(archivo, "text", {
      value: async () => contenido,
    });

    return archivo;
  }

  it("carga un JSON válido y actualiza los campos del formulario", async () => {
    render(<SeriesDeportivas />);

    const archivo = crearArchivo(JSON.stringify(datos));
    const input = screen.getByLabelText("Cargar JSON") as HTMLInputElement;

    fireEvent.change(input, { target: { files: [archivo] } });

    expect(
      await screen.findByText(
        "Configuración cargada. Puedes modificar todos los campos.",
      ),
    ).toBeTruthy();
    expect(
      (screen.getByLabelText("Cantidad máxima de juegos") as HTMLSelectElement)
        .value,
    ).toBe("3");
    expect(
      (
        screen.getByLabelText(
          "Probabilidad de ganar como local (ph)",
        ) as HTMLInputElement
      ).value,
    ).toBe("0.58");
    expect(
      (
        screen.getByLabelText(
          "Probabilidad de ganar como visitante (pr)",
        ) as HTMLInputElement
      ).value,
    ).toBe("0.45");
    expect((screen.getByLabelText("Juego 1") as HTMLSelectElement).value).toBe(
      "visitante",
    );
    expect((screen.getByLabelText("Juego 2") as HTMLSelectElement).value).toBe(
      "local",
    );
  });

  it("rechaza un archivo que no contiene JSON válido", async () => {
    render(<SeriesDeportivas />);

    const archivo = crearArchivo("{json-invalido");
    const input = screen.getByLabelText("Cargar JSON") as HTMLInputElement;

    fireEvent.change(input, { target: { files: [archivo] } });

    expect(
      await screen.findByText("El archivo no contiene un JSON válido."),
    ).toBeTruthy();
  });

  it("rechaza un JSON con una cantidad de juegos inválida", async () => {
    render(<SeriesDeportivas />);

    const archivo = crearArchivo(
      JSON.stringify({
        ...datos,
        juegos: 4,
        formato: [true, true, false, false],
      }),
    );
    const input = screen.getByLabelText("Cargar JSON") as HTMLInputElement;

    fireEvent.change(input, { target: { files: [archivo] } });

    expect(
      await screen.findByText(
        "La cantidad de juegos debe ser impar, entre 1 y 11.",
      ),
    ).toBeTruthy();
  });
});
