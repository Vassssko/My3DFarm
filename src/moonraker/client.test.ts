import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeBaseUrl, probeMoonraker, unwrapMoonrakerJson } from "./client";

describe("unwrapMoonrakerJson", () => {
  it("unwraps Moonraker HTTP { result } envelope", () => {
    expect(unwrapMoonrakerJson({ result: { a: 1 } })).toEqual({ a: 1 });
  });

  it("passes through flat JSON (legacy / mocks)", () => {
    expect(unwrapMoonrakerJson({ moonraker_version: "x" })).toEqual({ moonraker_version: "x" });
  });
});

describe("normalizeBaseUrl", () => {
  it("trims and strips trailing slashes", () => {
    expect(normalizeBaseUrl("  http://192.168.1.1:7125///  ")).toBe("http://192.168.1.1:7125");
  });

  it("keeps path-less origin", () => {
    expect(normalizeBaseUrl("http://10.0.0.5:7125")).toBe("http://10.0.0.5:7125");
  });
});

describe("probeMoonraker", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns HTTP status on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
      }),
    );
    await expect(probeMoonraker("http://192.0.2.1:7125")).resolves.toBe(200);
  });

  it("returns 401 when unauthorized", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 401,
      }),
    );
    await expect(probeMoonraker("http://192.0.2.1:7125")).resolves.toBe(401);
  });

  it("returns 0 on network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    await expect(probeMoonraker("http://192.0.2.1:7125")).resolves.toBe(0);
  });

  it("aborts when external signal aborts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      }),
    );
    const ac = new AbortController();
    const p = probeMoonraker("http://192.0.2.1:7125", undefined, ac.signal);
    ac.abort();
    await expect(p).resolves.toBe(0);
  });
});
