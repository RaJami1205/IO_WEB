// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PlantillaGeneral } from "../componentes/VentanaBienvenida";
import { comprobarSalud } from "../services/health";

const ok = () => new Response(JSON.stringify({ status: "ok" }));
let cancelar: (() => void) | undefined;
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  cancelar?.();
  cancelar = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
async function avanzar(ms = 0) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}
function montar(strict = false) {
  const vista = <MemoryRouter><PlantillaGeneral><p>Contenido</p></PlantillaGeneral></MemoryRouter>;
  return render(strict ? <StrictMode>{vista}</StrictMode> : vista);
}

describe("Salud global", () => {
  it("muestra inicio, éxito inmediato y no continúa consultando", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(ok());
    vi.stubGlobal("fetch", fetchMock);
    montar();
    expect(screen.getByText(/Iniciando conexión/)).toBeTruthy();
    await avanzar();
    expect(screen.getByText(/Servidor disponible/)).toBeTruthy();
    expect(vi.getTimerCount()).toBe(0);
    await avanzar(100_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/health", expect.objectContaining({ method: "GET" }));
  });

  it.each([502, 503, 504, "red"])("recupera un fallo transitorio %s sin recargar", async (error) => {
    const fetchMock = vi.fn<typeof fetch>();
    if (typeof error === "string") fetchMock.mockRejectedValueOnce(new TypeError("Red"));
    else fetchMock.mockResolvedValueOnce(new Response("", { status: error }));
    fetchMock.mockResolvedValueOnce(ok());
    vi.stubGlobal("fetch", fetchMock);
    montar();
    await avanzar();
    expect(screen.getByText(/Iniciando conexión/)).toBeTruthy();
    await avanzar(1000);
    expect(screen.getByText(/Servidor disponible/)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([401, 403, 404, "html", "estado"])("no reintenta una respuesta inválida %s", async (tipo) => {
    const respuesta = typeof tipo === "number" ? new Response("", { status: tipo })
      : new Response(tipo === "html" ? "<html>error</html>" : '{"status":"otro"}');
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(respuesta);
    vi.stubGlobal("fetch", fetchMock);
    montar();
    await avanzar(100_000);
    expect(screen.getByText(/Servidor no disponible/)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("permite recuperación manual y retira la acción durante el intento", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("", { status: 404 })).mockResolvedValueOnce(ok());
    vi.stubGlobal("fetch", fetchMock);
    montar();
    await avanzar();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar conexión" }));
    expect(screen.getByText(/Iniciando conexión/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reintentar conexión" })).toBeNull();
    await avanzar();
    expect(screen.getByText(/Servidor disponible/)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([false, true])("limita solicitudes pendientes y presupuesto; producción=%s", async (produccion) => {
    const signals: AbortSignal[] = [];
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((_url, opciones) => {
      expect(signals.every((signal) => signal.aborted)).toBe(true);
      signals.push(opciones!.signal!);
      return new Promise<Response>(() => {});
    });
    vi.stubGlobal("fetch", fetchMock);
    const finalizar = vi.fn();
    cancelar = comprobarSalud(finalizar, produccion);
    const plazo = produccion ? 90_000 : 8_000;
    await avanzar(plazo - 1);
    expect(finalizar).not.toHaveBeenCalled();
    await avanzar(1);
    expect(finalizar).toHaveBeenCalledExactlyOnceWith(false);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    const intentos = fetchMock.mock.calls.length;
    await avanzar(100_000);
    expect(fetchMock).toHaveBeenCalledTimes(intentos);
  });

  it("muestra fallo al agotar el plazo local con una solicitud pendiente", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockImplementation(() => new Promise<Response>(() => {})));
    montar();
    await avanzar(7999);
    expect(screen.getByText(/Iniciando conexión/)).toBeTruthy();
    await avanzar(1);
    expect(screen.getByText(/Servidor no disponible/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reintentar conexión" })).toBeTruthy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("también limita una lectura del cuerpo que no termina", async () => {
    const respuesta = new Response();
    vi.spyOn(respuesta, "json").mockImplementation(() => new Promise(() => {}));
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(respuesta);
    vi.stubGlobal("fetch", fetchMock);
    const finalizar = vi.fn();
    cancelar = comprobarSalud(finalizar, true);
    await avanzar(90_000);
    expect(finalizar).toHaveBeenCalledExactlyOnceWith(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ignora una respuesta tardía del intento que venció", async () => {
    let tardia!: (respuesta: Response) => void;
    const fetchMock = vi.fn<typeof fetch>()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { tardia = resolve; }))
      .mockResolvedValueOnce(ok());
    vi.stubGlobal("fetch", fetchMock);
    montar();
    await avanzar(4000);
    expect(screen.getByText(/Servidor disponible/)).toBeTruthy();
    await act(async () => { tardia(new Response("", { status: 404 })); });
    expect(screen.getByText(/Servidor disponible/)).toBeTruthy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancela la solicitud al desmontar incluso con StrictMode", async () => {
    const signals: AbortSignal[] = [];
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((_url, opciones) => {
      signals.push(opciones!.signal!);
      return new Promise<Response>(() => {});
    });
    vi.stubGlobal("fetch", fetchMock);
    const vista = montar(true);
    expect(signals.filter((signal) => !signal.aborted)).toHaveLength(1);
    vista.unmount();
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    const intentos = fetchMock.mock.calls.length;
    await avanzar(100_000);
    expect(fetchMock).toHaveBeenCalledTimes(intentos);
  });

  it("cancela una espera de reintento al desmontar", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Red"));
    vi.stubGlobal("fetch", fetchMock);
    const vista = montar();
    await avanzar();
    vista.unmount();
    await avanzar(100_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("una respuesta de la ruta anterior no sustituye la comprobación nueva", async () => {
    let tardia!: (respuesta: Response) => void;
    const fetchMock = vi.fn<typeof fetch>()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { tardia = resolve; }))
      .mockResolvedValueOnce(ok());
    vi.stubGlobal("fetch", fetchMock);
    montar();
    fireEvent.click(screen.getByRole("link", { name: "Matrices" }));
    await avanzar();
    expect(screen.getByText(/Servidor disponible/)).toBeTruthy();
    await act(async () => { tardia(new Response("", { status: 404 })); });
    expect(screen.getByText(/Servidor disponible/)).toBeTruthy();
    expect(fetchMock.mock.calls[0][1]!.signal!.aborted).toBe(true);
  });
});
