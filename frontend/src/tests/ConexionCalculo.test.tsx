// @vitest-environment jsdom
import { StrictMode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useConexionCalculo } from "../hooks/useConexionCalculo";

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const ok = () => new Response(JSON.stringify({ status: "ok" }));

it("health inmediato, bloqueo síncrono y StrictMode sin duplicar", async () => {
  const mock = vi.fn<typeof fetch>().mockResolvedValue(ok());
  vi.stubGlobal("fetch", mock);
  const { result } = renderHook(useConexionCalculo, { wrapper: StrictMode });
  const op = result.current.iniciar()!;
  expect(result.current.iniciar()).toBeNull();
  await act(async () => { await op.esperarConexion(); op.iniciarPost(); });
  expect(result.current.fase).toBe("calculando");
  expect(() => op.iniciarPost()).toThrow("ya fue iniciada");
  expect(mock).toHaveBeenCalledTimes(1);
  act(() => op.finalizar());
  expect(result.current.iniciar()).not.toBeNull();
});

it("recupera health transitorio y limpia los temporizadores", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockRejectedValueOnce(new Error("red")).mockResolvedValueOnce(ok()));
  const { result } = renderHook(useConexionCalculo);
  const op = result.current.iniciar()!;
  await act(async () => {
    const espera = op.esperarConexion();
    await vi.advanceTimersByTimeAsync(1000);
    await espera;
    op.finalizar();
  });
  expect(vi.getTimerCount()).toBe(0);
});

it.each([[false, 8000], [true, 90000]] as const)("respeta el presupuesto PROD=%s", async (prod, plazo) => {
  vi.useFakeTimers(); vi.stubEnv("PROD", prod);
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
  const { result } = renderHook(useConexionCalculo);
  const op = result.current.iniciar()!;
  let fallo: unknown;
  await act(async () => {
    const espera = op.esperarConexion().catch(e => { fallo = e; });
    await vi.advanceTimersByTimeAsync(plazo - 1);
    expect(fallo).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    await espera;
    op.finalizar();
  });
  expect(String(fallo)).toContain("No se pudo conectar");
  expect(vi.getTimerCount()).toBe(0);
  expect(result.current.iniciar()).not.toBeNull();
});

it("desmontar resuelve la espera cancelada y descarta health tardío", async () => {
  vi.useFakeTimers();
  let resolver!: (r: Response) => void;
  vi.stubGlobal("fetch", vi.fn(() => new Promise(r => { resolver = r; })));
  const { result, unmount } = renderHook(useConexionCalculo);
  const op = result.current.iniciar()!;
  let espera!: Promise<unknown>;
  act(() => { espera = op.esperarConexion().catch(e => e); });
  unmount();
  expect(await espera).toBeInstanceOf(Error);
  resolver(ok());
  await Promise.resolve();
  expect(() => op.iniciarPost()).toThrow();
  expect(vi.getTimerCount()).toBe(0);
});

it("una operación antigua no libera el bloqueo de la nueva", async () => {
  const { result } = renderHook(useConexionCalculo);
  const vieja = result.current.iniciar()!;
  act(() => vieja.finalizar());
  const nueva = result.current.iniciar()!;
  act(() => vieja.finalizar());
  expect(result.current.iniciar()).toBeNull();
  await expect(vieja.esperar(Promise.resolve("tardío"))).rejects.toThrow();
  expect(nueva.vigente()).toBe(true);
});

it("el plazo POST empieza tras health y termina también una lectura pendiente", async () => {
  vi.useFakeTimers(); vi.stubEnv("PROD", true);
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(ok()));
  const { result } = renderHook(useConexionCalculo);
  const op = result.current.iniciar()!;
  await act(async () => { await op.esperarConexion(); await vi.advanceTimersByTimeAsync(60000); });
  expect(op.signal.aborted).toBe(false);
  await act(async () => {
    op.iniciarPost();
    const espera = op.esperar(new Promise(() => {})).catch(e => e);
    await vi.advanceTimersByTimeAsync(29999);
    expect(op.signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(String(await espera)).toContain("30 segundos");
    op.finalizar();
  });
  expect(vi.getTimerCount()).toBe(0);
});

it("cancela el temporizador de animación sin continuar", async () => {
  vi.useFakeTimers();
  const { result, unmount } = renderHook(useConexionCalculo);
  const op = result.current.iniciar()!;
  const espera = op.pausa(200).catch(e => e);
  unmount();
  expect(await espera).toBeInstanceOf(Error);
  expect(vi.getTimerCount()).toBe(0);
});
