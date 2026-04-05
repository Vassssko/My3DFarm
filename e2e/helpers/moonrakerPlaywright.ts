import type { Page } from "@playwright/test";
import {
  mockObjectsList,
  mockObjectsQueryPrinting,
  mockObjectsQueryReady,
  mockPrinterInfo,
  mockProcStats,
  mockServerInfoReady,
  MOCK_MOONRAKER_ORIGIN,
} from "../../src/test/moonrakerFixtures";

export { MOCK_MOONRAKER_ORIGIN };

export type MockPrinterMode = "ready" | "printing";

/**
 * Intercept HTTP to documentation IP 192.0.2.1:7125 (Moonraker mock).
 */
export async function installMoonrakerPlaywrightMock(
  page: Page,
  mode: MockPrinterMode = "ready",
): Promise<void> {
  const query = mode === "printing" ? mockObjectsQueryPrinting : mockObjectsQueryReady;
  const origin = MOCK_MOONRAKER_ORIGIN.replace(/\/$/, "");

  await page.route(`${origin}/**`, async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const method = req.method();

    const json = (body: object, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });

    if (path === "/server/info") {
      return json(mockServerInfoReady);
    }
    if (path === "/machine/proc_stats") {
      return json(mockProcStats);
    }
    if (path === "/printer/info") {
      return json(mockPrinterInfo);
    }
    if (path === "/printer/objects/list") {
      return json(mockObjectsList);
    }
    if (path === "/printer/objects/query" && method === "POST") {
      return json(query);
    }
    return route.fulfill({ status: 404, body: "not found" });
  });
}

/** Zustand persist payload for `my3dfarm-printers` (see zustand/middleware/persist). */
export function persistedPrinterState(printers: { id: string; baseUrl: string; displayName: string }[]) {
  return JSON.stringify({
    state: {
      printers,
      discoveryOpen: false,
      gridEditMode: false,
    },
    version: 0,
  });
}
