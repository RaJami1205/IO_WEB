// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import Mochila from "../componentes/Mochila";

afterEach(cleanup);

describe("Problema de la Mochila: carga de archivos JSON", () => {
  const datos = {
    algoritmo: "mochila",
    variante: "acotada",
    capacidad: 10,
    objetos: [
      { nombre: "Libro", peso: 2, valor: 4.5, cantidad: 3 },
      { nombre: "Agua", peso: 3, valor: 6, cantidad: 2 },
    ],
  };

  function crearArchivo(contenido: string): File {
    const archivo = new File([contenido], "mochila.json", {
      type: "application/json",
    });

    Object.defineProperty(archivo, "text", {
      value: async () => contenido,
    });

    return archivo;
  }

  it("carga una configuración válida y actualiza objetos y capacidad", async () => {
    render(<Mochila />);

    const archivo = crearArchivo(JSON.stringify(datos));

    const input = screen.getByLabelText(/cargar.*json/i) as HTMLInputElement;

    fireEvent.change(input, { target: { files: [archivo] } });

    expect(await screen.findByText("Configuración cargada.")).toBeTruthy();

    expect((screen.getByLabelText("Variante") as HTMLSelectElement).value).toBe(
      "acotada",
    );

    expect(
      (screen.getByLabelText("Capacidad de la mochila") as HTMLInputElement)
        .value,
    ).toBe("10");

    expect(screen.getByText("3. Objetos agregados (2)")).toBeTruthy();

    expect(screen.getByText("Libro")).toBeTruthy();
    expect(screen.getByText("Agua")).toBeTruthy();

    expect(
      (
        screen.getByLabelText(
          "Cantidad disponible de Libro",
        ) as HTMLInputElement
      ).value,
    ).toBe("3");
  });

  it("rechaza un archivo que contiene JSON mal formado", async () => {
    render(<Mochila />);

    const archivo = crearArchivo("{json-invalido");

    const input = screen.getByLabelText(/cargar.*json/i) as HTMLInputElement;

    fireEvent.change(input, { target: { files: [archivo] } });

    expect(await screen.findByRole("alert")).toBeTruthy();

    expect(screen.getByText("3. Objetos agregados (0)")).toBeTruthy();
  });

  it("rechaza una configuración con capacidad fuera del rango", async () => {
    render(<Mochila />);

    const archivo = crearArchivo(JSON.stringify({ ...datos, capacidad: 0 }));

    const input = screen.getByLabelText(/cargar.*json/i) as HTMLInputElement;

    fireEvent.change(input, { target: { files: [archivo] } });

    expect(
      await screen.findByText("La capacidad debe ser un entero entre 1 y 20."),
    ).toBeTruthy();
  });
});
