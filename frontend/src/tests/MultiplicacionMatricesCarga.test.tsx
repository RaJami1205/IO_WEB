// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import MultiplicacionMatrices from "../componentes/MultiplicacionMatrices";

const ubicacionInicial = window.location.href;
const historialInicial = window.history.state;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(historialInicial, "", ubicacionInicial);
});

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

  it.each(["/multiplicacion-matrices", "/multiplicacion-matrices/"])(
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
      render(<MultiplicacionMatrices />);

      fireEvent.change(screen.getByLabelText("Cargar JSON"), {
        target: { files: [crearArchivo(JSON.stringify(datos))] },
      });
      await screen.findByText("Archivo cargado. Puedes editar las dimensiones.");
      fireEvent.click(screen.getByRole("button", { name: "Calcular asociación óptima" }));
      expect((await screen.findByRole("alert")).textContent)
        .toBe("Respuesta controlada de la API");

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/health", {
        signal: expect.any(AbortSignal),
      });
      expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/multiplicacion-matrices", {
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
