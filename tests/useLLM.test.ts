import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLLM } from "../src/useLLM";
import type { SendRequestOptions } from "../src/useLLM";

// Minimal context options so the hook doesn't throw
const baseOptions = { project_id: "test-project" };

function mockFetchResponse(body: string, headers?: Record<string, string>) {
  const headerMap = new Map(Object.entries(headers ?? {}));
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(body));
      controller.close();
    },
  });

  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: { get: (key: string) => headerMap.get(key) ?? null },
    body: stream,
  } as unknown as Response;
}

describe("useLLM send – batch option", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends a request without batch when no requestOptions are provided (backward compat)", async () => {
    const fakeResponse = mockFetchResponse("hello", { "x-callId": "abc-123" });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(fakeResponse);

    const { result } = renderHook(() => useLLM(baseOptions));

    await act(async () => {
      await result.current.send("Hello", [], [], false);
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const sentBody = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(sentBody).not.toHaveProperty("batch");
    expect(sentBody.prompt).toBe("Hello");
  });

  it("includes batch: true in request body when requestOptions.batch is true", async () => {
    const fakeResponse = mockFetchResponse("queued", { "x-callId": "batch-1" });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(fakeResponse);

    const { result } = renderHook(() => useLLM(baseOptions));

    await act(async () => {
      await result.current.send(
        "process data",
        [],
        [],
        false,
        true,
        null,
        null,
        new AbortController(),
        undefined,
        undefined,
        { batch: true }
      );
    });

    const sentBody = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(sentBody.batch).toBe(true);
  });

  it("includes batch: false in request body when requestOptions.batch is false", async () => {
    const fakeResponse = mockFetchResponse("ok", { "x-callId": "batch-2" });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(fakeResponse);

    const { result } = renderHook(() => useLLM(baseOptions));

    await act(async () => {
      await result.current.send(
        "prompt",
        [],
        [],
        false,
        true,
        null,
        null,
        new AbortController(),
        undefined,
        undefined,
        { batch: false }
      );
    });

    const sentBody = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(sentBody.batch).toBe(false);
  });

  it("captures lastCallId from x-callId header on batch responses", async () => {
    const callId = "batch-call-789";
    const fakeResponse = mockFetchResponse("queued", { "x-callId": callId });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(fakeResponse);

    const { result } = renderHook(() => useLLM(baseOptions));

    await act(async () => {
      await result.current.send(
        "batch prompt",
        [],
        [],
        false,
        true,
        null,
        null,
        new AbortController(),
        undefined,
        undefined,
        { batch: true }
      );
    });

    expect(result.current.lastCallId).toBe(callId);
  });

  it("captures lastCallId from x-callId header on non-batch responses", async () => {
    const callId = "normal-call-456";
    const fakeResponse = mockFetchResponse("response text", { "x-callId": callId });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(fakeResponse);

    const { result } = renderHook(() => useLLM(baseOptions));

    await act(async () => {
      await result.current.send("hello", [], [], false);
    });

    expect(result.current.lastCallId).toBe(callId);
  });

  it("fires onComplete with body text for batch calls", async () => {
    const fakeResponse = mockFetchResponse("batch result body", { "x-callId": "c1" });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(fakeResponse);

    const onComplete = vi.fn();
    const { result } = renderHook(() => useLLM(baseOptions));

    await act(async () => {
      await result.current.send(
        "prompt",
        [],
        [],
        false,
        true,
        null,
        null,
        new AbortController(),
        onComplete,
        undefined,
        { batch: true }
      );
    });

    expect(onComplete).toHaveBeenCalledWith("batch result body");
  });

  it("returns idle true after a batch call completes", async () => {
    const fakeResponse = mockFetchResponse("done", { "x-callId": "c2" });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(fakeResponse);

    const { result } = renderHook(() => useLLM(baseOptions));

    await act(async () => {
      await result.current.send(
        "prompt",
        [],
        [],
        false,
        true,
        null,
        null,
        new AbortController(),
        undefined,
        undefined,
        { batch: true }
      );
    });

    expect(result.current.idle).toBe(true);
  });
});

// Type-level check: SendRequestOptions is importable and structurally correct
describe("SendRequestOptions type", () => {
  it("allows an empty object", () => {
    const opts: SendRequestOptions = {};
    expect(opts).toBeDefined();
  });

  it("allows batch boolean", () => {
    const opts: SendRequestOptions = { batch: true };
    expect(opts.batch).toBe(true);
  });
});
