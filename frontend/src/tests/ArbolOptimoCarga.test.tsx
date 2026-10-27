// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ArbolOptimo from "../componentes/ArbolOptimo";

afterEach(cleanup);

describe("Árbol Óptimo: carga de archivos JSON", () => {
  const datos = {
    algoritmo: "abb-optimo",
    llaves: [
      { llave: "while", peso: 12 },
      { llave: "if", peso: 20 },
      { llave: "do", peso: 5.5 },
    ],
  };

  function crearArchivo(contenido: string): File {
    const archivo = new File([contenido], "abb-optimo.json", {
      type: "application/json",
    });

    Object.defineProperty(archivo, "text", {
      value: async () => contenido,
    });

    return archivo;
  }

  it("carga un JSON válido y muestra las llaves y sus pesos", async () => {
    render(<ArbolOptimo />);

    const archivo = crearArchivo(JSON.stringify(datos));
    const input = screen.getByLabelText("Cargar JSON") as HTMLInputElement;

    fireEvent.change(input, { target: { files: [archivo] } });

    expect(
      await screen.findByText("JSON cargado. Puedes editar todas las llaves."),
    ).toBeTruthy();
    expect(
      (screen.getByLabelText("Texto de llave 1") as HTMLInputElement).value,
    ).toBe("while");
    expect(
      (screen.getByLabelText("Peso de llave 1") as HTMLInputElement).value,
    ).toBe("12");
    expect(
      (screen.getByLabelText("Texto de llave 2") as HTMLInputElement).value,
    ).toBe("if");
    expect(
      (screen.getByLabelText("Peso de llave 3") as HTMLInputElement).value,
    ).toBe("5.5");
    expect(screen.getByText("3 / 10 llaves")).toBeTruthy();
  });

  it("rechaza un archivo con JSON mal formado", async () => {
    render(<ArbolOptimo />);

    const archivo = crearArchivo("{json-invalido");
    const input = screen.getByLabelText("Cargar JSON") as HTMLInputElement;

    fireEvent.change(input, { target: { files: [archivo] } });

    expect(
      await screen.findByText("El archivo no contiene un JSON válido."),
    ).toBeTruthy();
  });

  it("rechaza archivos con llaves duplicadas", async () => {
    render(<ArbolOptimo />);

    const archivo = crearArchivo(
      JSON.stringify({
        algoritmo: "abb-optimo",
        llaves: [
          { llave: "if", peso: 2 },
          { llave: "if", peso: 4 },
        ],
      }),
    );
    const input = screen.getByLabelText("Cargar JSON") as HTMLInputElement;

    fireEvent.change(input, { target: { files: [archivo] } });

    expect(
      await screen.findByText('La llave "if" está repetida.'),
    ).toBeTruthy();
  });
});
