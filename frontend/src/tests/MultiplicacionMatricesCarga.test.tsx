// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import MultiplicacionMatrices from "../componentes/MultiplicacionMatrices";

afterEach(cleanup);

describe("Multiplicación de Matrices: carga de archivos JSON", () => {
  const datos = {
    algoritmo: "multiplicacion-matrices",
    dimensiones: [30, 35, 15, 5],
  };

  function crearArchivo(contenido: string): File {
    const archivo = new File([contenido], "multiplicacion-matrices.json", {
      type: "application/json",
    });

    Object.defineProperty(archivo, "text", {
      value: async () => contenido,
    });

    return archivo;
  }

  it("carga un archivo válido y actualiza las dimensiones", async () => {
    render(<MultiplicacionMatrices />);

    const archivo = crearArchivo(JSON.stringify(datos));
    const input = screen.getByLabelText("Cargar JSON") as HTMLInputElement;

    fireEvent.change(input, { target: { files: [archivo] } });

    expect(
      await screen.findByText(
        "Archivo cargado. Puedes editar las dimensiones.",
      ),
    ).toBeTruthy();
    expect(
      (screen.getByLabelText("Número de matrices (n)") as HTMLSelectElement)
        .value,
    ).toBe("3");
    expect(screen.getByText("3 matrices")).toBeTruthy();
    expect((screen.getByLabelText("D0") as HTMLInputElement).value).toBe("30");
    expect((screen.getByLabelText("D1") as HTMLInputElement).value).toBe("35");
    expect((screen.getByLabelText("D2") as HTMLInputElement).value).toBe("15");
    expect((screen.getByLabelText("D3") as HTMLInputElement).value).toBe("5");
    expect(screen.queryByLabelText("D4")).toBeNull();
  });

  it("rechaza un archivo con JSON mal formado", async () => {
    render(<MultiplicacionMatrices />);

    const archivo = crearArchivo("{json-invalido");
    const input = screen.getByLabelText("Cargar JSON") as HTMLInputElement;

    fireEvent.change(input, { target: { files: [archivo] } });

    expect(
      await screen.findByText("El archivo no contiene un JSON válido."),
    ).toBeTruthy();
  });

  it("rechaza un archivo con dimensiones negativas", async () => {
    render(<MultiplicacionMatrices />);

    const archivo = crearArchivo(
      JSON.stringify({ ...datos, dimensiones: [30, -5, 10] }),
    );
    const input = screen.getByLabelText("Cargar JSON") as HTMLInputElement;

    fireEvent.change(input, { target: { files: [archivo] } });

    expect(
      await screen.findByText(
        "Todas las dimensiones deben ser enteros positivos.",
      ),
    ).toBeTruthy();
  });
});
