import { clearDebugEvents } from "../lib/debugRingBuffer";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  mockObjectsList,
  mockObjectsQueryPrinting,
  mockObjectsQueryReady,
  mockPrinterInfo,
  mockProcStats,
  mockServerInfoReady,
  MOCK_MOONRAKER_ORIGIN,
} from "../test/moonrakerFixtures";
import {
  buildPrinterSnapshot,
  deriveCardStatus,
  formatSystemUptime,
  formatWaitDuration,
  type StatusDerivationInput,
} from "./snapshot";

function s(p: Partial<StatusDerivationInput>): StatusDerivationInput {
  return {
    fetchFailed: false,
    ...p,
  };
}

describe("deriveCardStatus", () => {
  it("offline when fetch failed", () => {
    expect(deriveCardStatus(s({ fetchFailed: true }))).toBe("offline");
  });

  it("error on webhook shutdown", () => {
    expect(
      deriveCardStatus(
        s({ webhooks_state: "shutdown", klippy_connected: true, klippy_state: "ready" }),
      ),
    ).toBe("error");
  });

  it("error when klippy disconnected", () => {
    expect(deriveCardStatus(s({ klippy_connected: false }))).toBe("error");
  });

  it("printing when print_stats printing", () => {
    expect(
      deriveCardStatus(
        s({
          klippy_connected: true,
          klippy_state: "ready",
          webhooks_state: "ready",
          print_stats_state: "printing",
        }),
      ),
    ).toBe("printing");
  });

  it("ready when klippy ready and standby", () => {
    expect(
      deriveCardStatus(
        s({
          klippy_connected: true,
          klippy_state: "ready",
          webhooks_state: "ready",
          print_stats_state: "standby",
        }),
      ),
    ).toBe("ready");
  });

  it("printing (busy) on startup", () => {
    expect(
      deriveCardStatus(
        s({
          klippy_connected: true,
          klippy_state: "startup",
          webhooks_state: "ready",
        }),
      ),
    ).toBe("printing");
  });
});

describe("formatSystemUptime", () => {
  it("returns em dash for null or non-positive", () => {
    expect(formatSystemUptime(null, "en")).toBe("—");
    expect(formatSystemUptime(0, "ru")).toBe("—");
  });

  it("formats Russian with Cyrillic unit suffixes", () => {
    const sec = 15 * 86400 + 18 * 3600;
    expect(formatSystemUptime(sec, "ru")).toBe("15д 18ч");
    expect(formatSystemUptime(3600 + 5 * 60, "ru")).toBe("1ч 5м");
    expect(formatSystemUptime(90, "ru")).toBe("1м");
  });

  it("formats English with d/h/m", () => {
    const sec = 15 * 86400 + 18 * 3600;
    expect(formatSystemUptime(sec, "en")).toBe("15d 18h");
  });
});

describe("formatWaitDuration", () => {
  it("formats ru-style under one hour", () => {
    expect(formatWaitDuration(90, "ru")).toBe("1 мин");
  });

  it("formats en with hours", () => {
    expect(formatWaitDuration(3700, "en")).toBe("1h 1m");
  });

  it("uses sub-minute token when zero", () => {
    expect(formatWaitDuration(0, "ru")).toBe("< 1 мин");
    expect(formatWaitDuration(30, "en")).toBe("< 1m");
  });
});

function installMoonrakerFetchMock(
  queryBody: typeof mockObjectsQueryReady | typeof mockObjectsQueryPrinting,
) {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const u = new URL(url);
    const path = u.pathname;
    if (path === "/server/info") {
      return Promise.resolve(new Response(JSON.stringify(mockServerInfoReady), { status: 200 }));
    }
    if (path === "/machine/proc_stats") {
      return Promise.resolve(new Response(JSON.stringify(mockProcStats), { status: 200 }));
    }
    if (path === "/printer/info") {
      return Promise.resolve(new Response(JSON.stringify(mockPrinterInfo), { status: 200 }));
    }
    if (path === "/printer/objects/list") {
      return Promise.resolve(new Response(JSON.stringify(mockObjectsList), { status: 200 }));
    }
    if (path === "/printer/objects/query" && init?.method === "POST") {
      return Promise.resolve(new Response(JSON.stringify(queryBody), { status: 200 }));
    }
    return Promise.resolve(new Response("not found", { status: 404 }));
  });
}

describe("buildPrinterSnapshot", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearDebugEvents();
  });

  it("returns offline when /server/info fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("err", { status: 500 })),
    );
    const snap = await buildPrinterSnapshot(MOCK_MOONRAKER_ORIGIN, "fallback-host");
    expect(snap.status).toBe("offline");
    expect(snap.hostname).toBe("fallback-host");
    expect(snap.offlineDetail).toBe("http");
    expect(snap.httpStatus).toBe(500);
  });

  it("returns offline with auth hint on 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("unauthorized", { status: 401 })),
    );
    const snap = await buildPrinterSnapshot(MOCK_MOONRAKER_ORIGIN, "h");
    expect(snap.status).toBe("offline");
    expect(snap.offlineDetail).toBe("auth");
    expect(snap.httpStatus).toBe(401);
  });

  it("returns offline unreachable on network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("fail")));
    const snap = await buildPrinterSnapshot(MOCK_MOONRAKER_ORIGIN, "h");
    expect(snap.status).toBe("offline");
    expect(snap.offlineDetail).toBe("unreachable");
  });

  it("maps ready printer from mocked Moonraker responses", async () => {
    vi.stubGlobal("fetch", installMoonrakerFetchMock(mockObjectsQueryReady));
    const snap = await buildPrinterSnapshot(MOCK_MOONRAKER_ORIGIN, "fallback-host");
    expect(snap.status).toBe("ready");
    expect(snap.hostname).toBe(mockPrinterInfo.hostname);
    expect(snap.moonrakerVersion).toBe(mockServerInfoReady.moonraker_version);
    expect(snap.klipperHostVersion).toBe(mockPrinterInfo.software_version);
    expect(snap.mcuVersions.length).toBeGreaterThan(0);
    expect(snap.printFilename).toBeNull();
    expect(snap.isIdleReady).toBe(true);
  });

  it("maps ready printer when API wraps payloads in { result } (Moonraker 1.5+)", async () => {
    const inner = installMoonrakerFetchMock(mockObjectsQueryReady);
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const p = inner(input, init) as Promise<Response>;
      return p.then(async (res) => {
        const body = await res.text();
        const wrapped = JSON.stringify({ result: JSON.parse(body) });
        return new Response(wrapped, { status: res.status, headers: res.headers });
      });
    });
    const snap = await buildPrinterSnapshot(MOCK_MOONRAKER_ORIGIN, "fallback-host");
    expect(snap.status).toBe("ready");
    expect(snap.moonrakerVersion).toBe(mockServerInfoReady.moonraker_version);
    expect(snap.uptimeSec).toBe(mockProcStats.system_uptime);
  });

  it("maps printing job and filename", async () => {
    vi.stubGlobal("fetch", installMoonrakerFetchMock(mockObjectsQueryPrinting));
    const snap = await buildPrinterSnapshot(MOCK_MOONRAKER_ORIGIN, "x");
    expect(snap.status).toBe("printing");
    expect(snap.printFilename).toBe("benchy.gcode");
    expect(snap.isActivelyPrinting).toBe(true);
  });
});
