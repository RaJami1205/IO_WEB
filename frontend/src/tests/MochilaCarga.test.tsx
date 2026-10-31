// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import Mochila from "../componentes/Mochila";

afterEach(cleanup);

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

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

  async function prepararCalculo() {
    const vista = render(<Mochila />);
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
    const posts = mock.mock.calls.filter(([url, init]) => url === "/api/problema-mochila" && init?.method === "POST");
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
    fireEvent.change(screen.getByLabelText("Capacidad de la mochila"), { target: { value: "0" } });
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
    fireEvent.change(screen.getByLabelText("Capacidad de la mochila"), { target: { value: "0" } });
    await act(async () => { resolver(saludOk()); });
    const posts = mock.mock.calls.filter(([, init]) => init?.method === "POST");
    expect(posts).toHaveLength(1);
    expect(JSON.parse(String(posts[0][1]?.body))).toEqual(datos);
  });

  it.each(["0-1", "no-acotada"])("conserva el payload de la variante %s", async (variante) => {
    const mock = vi.fn<typeof fetch>().mockResolvedValueOnce(saludOk()).mockResolvedValueOnce(errorPost());
    vi.stubGlobal("fetch", mock);
    const vista = await prepararCalculo();
    fireEvent.change(screen.getByLabelText("Variante"), { target: { value: variante } });
    await act(async () => { vista.enviar(); });
    const posts = mock.mock.calls.filter(([, init]) => init?.method === "POST");
    expect(posts).toHaveLength(1);
    expect(JSON.parse(String(posts[0][1]?.body))).toEqual({ ...datos, variante,
      objetos: datos.objetos.map(({ nombre, peso, valor }) => ({ nombre, peso, valor })) });
  });
});
