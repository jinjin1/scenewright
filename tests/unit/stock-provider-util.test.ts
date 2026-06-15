import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchJson,
  makeKeyReader,
  RESULTS_PER_PAGE,
} from "../../src/pipeline/stock/provider-util.js";

const ENV = "__TEST_STOCK_KEY__";

// fetch globals(Response)에 의존하지 않도록 최소 응답 객체를 만든다.
const mockRes = (status: number, body: unknown): Response =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

describe("RESULTS_PER_PAGE", () => {
  it("is a positive integer", () => {
    expect(Number.isInteger(RESULTS_PER_PAGE)).toBe(true);
    expect(RESULTS_PER_PAGE).toBeGreaterThan(0);
  });
});

describe("makeKeyReader", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env[ENV];
  });

  it("returns the key when the env var is set", () => {
    process.env[ENV] = "secret";
    expect(makeKeyReader(ENV, "testprov")()).toBe("secret");
  });

  it("returns null and warns exactly once when the env var is missing", () => {
    delete process.env[ENV];
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const read = makeKeyReader(ENV, "testprov");
    expect(read()).toBeNull();
    expect(read()).toBeNull();
    expect(read()).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain(`stock(testprov): ${ENV} not set`);
  });

  it("isolates warn-state per reader instance", () => {
    delete process.env[ENV];
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    makeKeyReader(ENV, "a")();
    makeKeyReader(ENV, "b")();
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe("fetchJson", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns parsed JSON on a 2xx response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockRes(200, { ok: 1 }));
    expect(await fetchJson<{ ok: number }>("https://x", {}, "prov", "search")).toEqual({ ok: 1 });
  });

  it("returns null and warns on a non-2xx response", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockRes(429, null));
    expect(await fetchJson("https://x", {}, "prov", "search")).toBeNull();
    expect(warn).toHaveBeenCalledWith("stock(prov): search returned 429");
  });

  it("returns null and warns when fetch throws", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    expect(await fetchJson("https://x", {}, "prov", "search")).toBeNull();
    expect(String(warn.mock.calls[0]?.[0])).toBe("stock(prov): search fetch failed:");
  });
});
