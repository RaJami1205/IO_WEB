// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import ArbolOptimo from "../componentes/ArbolOptimo";

const ubicacionInicial = window.location.href;
const historialInicial = window.history.state;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(historialInicial, "", ubicacionInicial);
});

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

    expect(await screen.findByText("JSON cargado correctamente.")).toBeTruthy();

    expect(screen.getByText("3 / 10 llaves")).toBeTruthy();

    const tabla = screen.getByRole("table");
    const filas = within(tabla).getAllByRole("row");

    expect(filas).toHaveLength(4);

    const celdasFila1 = within(filas[1])
      .getAllByRole("cell")
      .map((celda) => celda.textContent?.trim());

    expect(celdasFila1.slice(0, 3)).toEqual(["1", "while", "12"]);

    const celdasFila2 = within(filas[2])
      .getAllByRole("cell")
      .map((celda) => celda.textContent?.trim());

    expect(celdasFila2.slice(0, 3)).toEqual(["2", "if", "20"]);

    const celdasFila3 = within(filas[3])
      .getAllByRole("cell")
      .map((celda) => celda.textContent?.trim());

    expect(celdasFila3.slice(0, 3)).toEqual(["3", "do", "5.5"]);
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

  it.each(["/ArbolOptimo", "/ArbolOptimo/"])(
    "envía las solicitudes a la raíz del origen desde %s",
    async (ruta) => {
      window.history.replaceState(null, "", ruta);
      // El error controlado completa la solicitud sin depender de tablas o animaciones.
      const fetchMock = vi.fn<typeof fetch>()
        .mockResolvedValueOnce(new Response(JSON.stringify({ status: "ok" })))
        .mockResolvedValueOnce(new Response(
          JSON.stringify({ detail: "Respuesta controlada de la API" }),
          { status: 422 },
        ));
      vi.stubGlobal("fetch", fetchMock);
      render(<ArbolOptimo />);

      fireEvent.change(screen.getByLabelText("Cargar JSON"), {
        target: { files: [crearArchivo(JSON.stringify(datos))] },
      });
      await screen.findByText("JSON cargado correctamente.");
      fireEvent.click(screen.getByRole("button", { name: "Calcular árbol óptimo" }));
      expect((await screen.findByRole("alert")).textContent)
        .toBe("Respuesta controlada de la API");

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/health", {
        signal: expect.any(AbortSignal),
      });
      expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/abb-optimo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      });
      for (const [url] of fetchMock.mock.calls) {
        expect(new URL(String(url), window.location.href).pathname).toBe(url);
      }
    },
  );
});
