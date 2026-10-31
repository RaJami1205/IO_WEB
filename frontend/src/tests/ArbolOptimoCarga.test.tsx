// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
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

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

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
        method: "GET",
        cache: "no-store",
      });
      expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/abb-optimo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
        signal: expect.any(AbortSignal),
      });
      for (const [url] of fetchMock.mock.calls) {
        expect(new URL(String(url), window.location.href).pathname).toBe(url);
      }
    },
  );

  async function prepararCalculo() {
    const vista = render(<ArbolOptimo />);
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/cargar.*json/i), {
        target: { files: [crearArchivo(JSON.stringify(datos))] },
      });
    });
    const boton = screen.getByRole("button", { name: /^Calcular/ });
    const enviar = () => fireEvent.click(boton);
    return { ...vista, enviar };
  }
  const errorPost = () => new Response(JSON.stringify({ detail: "Error controlado" }), { status: 422 });
  const saludOk = () => new Response(JSON.stringify({ status: "ok" }));

  it.each([false, true])("conserva el contrato y envía un POST tras health (transitorio=%s)", async (transitorio) => {
    vi.useFakeTimers();
    const mock = vi.fn<typeof fetch>();
    if (transitorio) mock.mockResolvedValueOnce(new Response("", { status: 503 }));
    mock.mockResolvedValueOnce(saludOk()).mockResolvedValueOnce(errorPost());
    vi.stubGlobal("fetch", mock);
    const vista = await prepararCalculo();
    await act(async () => { vista.enviar(); });
    if (transitorio) {
      expect(screen.getByText("Conectando con el servidor…")).toBeTruthy();
      await act(async () => { vista.enviar(); await vi.advanceTimersByTimeAsync(1000); });
    }
    const posts = mock.mock.calls.filter(([url, init]) => url === "/api/abb-optimo" && init?.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0][1]).toEqual({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(datos), signal: expect.any(AbortSignal) });
    expect(screen.getByRole("alert").textContent).toContain("Error controlado");
    await act(async () => { await vi.advanceTimersByTimeAsync(90000); });
    expect(mock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("falla health sin POST y permite otro intento manual", async () => {
    const mock = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response("", { status: 404 }));
    vi.stubGlobal("fetch", mock);
    const vista = await prepararCalculo();
    await act(async () => { vista.enviar(); });
    expect(screen.getByRole("alert").textContent).toContain("No se pudo conectar");
    expect(mock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
    mock.mockResolvedValueOnce(saludOk()).mockResolvedValueOnce(errorPost());
    await act(async () => { vista.enviar(); });
    expect(mock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
  });

  it("cancela health al desmontar e ignora la respuesta antigua", async () => {
    vi.useFakeTimers();
    let resolver!: (r: Response) => void;
    const mock = vi.fn<typeof fetch>().mockImplementation(() => new Promise(r => { resolver = r; }));
    vi.stubGlobal("fetch", mock);
    const vista = await prepararCalculo();
    await act(async () => { vista.enviar(); vista.enviar(); });
    expect(mock).toHaveBeenCalledTimes(1);
    vista.unmount();
    expect(mock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    await act(async () => { resolver(saludOk()); await vi.advanceTimersByTimeAsync(90000); });
    expect(mock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aborta el POST pendiente sin reenviarlo al desmontar", async () => {
    const mock = vi.fn<typeof fetch>().mockResolvedValueOnce(saludOk()).mockImplementation(() => new Promise(() => {}));
    vi.stubGlobal("fetch", mock);
    const vista = await prepararCalculo();
    await act(async () => { vista.enviar(); });
    const posts = mock.mock.calls.filter(([, init]) => init?.method === "POST");
    expect(posts).toHaveLength(1);
    expect(screen.getByText("Calculando…")).toBeTruthy();
    await act(async () => { vista.unmount(); });
    expect(posts[0][1]?.signal?.aborted).toBe(true);
  });
  it("rechaza configuración inválida antes de cualquier solicitud", async () => {
    const mock = vi.fn(); vi.stubGlobal("fetch", mock);
    const vista = await prepararCalculo();
    while (screen.queryAllByRole("button", { name: "Eliminar" }).length) {
      fireEvent.click(screen.getAllByRole("button", { name: "Eliminar" })[0]);
    }
    await act(async () => { vista.enviar(); });
    expect(mock).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect((screen.getByRole("button", { name: /^Calcular/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("captura los datos del clic aunque cambie el formulario durante health", async () => {
    let resolver!: (r: Response) => void;
    const mock = vi.fn<typeof fetch>().mockImplementationOnce(() => new Promise(r => { resolver = r; })).mockResolvedValueOnce(errorPost());
    vi.stubGlobal("fetch", mock);
    const vista = await prepararCalculo();
    await act(async () => { vista.enviar(); });
    while (screen.queryAllByRole("button", { name: "Eliminar" }).length) {
      fireEvent.click(screen.getAllByRole("button", { name: "Eliminar" })[0]);
    }
    await act(async () => { resolver(saludOk()); });
    const posts = mock.mock.calls.filter(([, init]) => init?.method === "POST");
    expect(posts).toHaveLength(1);
    expect(JSON.parse(String(posts[0][1]?.body))).toEqual(datos);
  });
});
