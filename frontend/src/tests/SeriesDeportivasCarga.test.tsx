// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import SeriesDeportivas from "../componentes/SeriesDeportivas";

afterEach(cleanup);

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

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

  async function prepararCalculo() {
    const vista = render(<SeriesDeportivas />);
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/cargar.*json/i), {
        target: { files: [crearArchivo(JSON.stringify(datos))] },
      });
    });
    const boton = screen.getByRole("button", { name: /^Calcular/ });
    const enviar = () => fireEvent.submit(boton.closest("form")!);
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
    const posts = mock.mock.calls.filter(([url, init]) => url === "/api/series-deportivas" && init?.method === "POST");
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
    fireEvent.change(screen.getByLabelText(/Probabilidad de ganar como local/), { target: { value: "2" } });
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
    fireEvent.change(screen.getByLabelText(/Probabilidad de ganar como local/), { target: { value: "2" } });
    await act(async () => { resolver(saludOk()); });
    const posts = mock.mock.calls.filter(([, init]) => init?.method === "POST");
    expect(posts).toHaveLength(1);
    expect(JSON.parse(String(posts[0][1]?.body))).toEqual(datos);
  });
});
