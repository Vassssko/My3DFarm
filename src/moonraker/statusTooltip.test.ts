import { describe, expect, it } from "vitest";
import type { PrinterSnapshot } from "./snapshot";
import { formatStatusTooltipTitle, resolvePrinterStatusTooltip } from "./statusTooltip";

function baseSnap(over: Partial<PrinterSnapshot>): PrinterSnapshot {
  return {
    status: "ready",
    hostname: "x",
    moonrakerVersion: "v1",
    klipperHostVersion: "v1",
    mcuVersions: [],
    uptimeSec: null,
    printFilename: null,
    isActivelyPrinting: false,
    isIdleReady: true,
    raw: {},
    ...over,
  };
}

describe("resolvePrinterStatusTooltip", () => {
  it("returns null for plain ready", () => {
    expect(resolvePrinterStatusTooltip(baseSnap({}), "ready")).toBeNull();
  });

  it("dirty build hint", () => {
    expect(resolvePrinterStatusTooltip(baseSnap({}), "dirtyBuild")).toEqual({
      i18nKey: "printer.statusHint.dirtyBuild",
    });
  });

  it("offline auth", () => {
    const snap = baseSnap({
      status: "offline",
      offlineDetail: "auth",
    });
    expect(resolvePrinterStatusTooltip(snap, "offline")).toEqual({
      i18nKey: "printer.statusHint.offlineAuth",
    });
  });

  it("error when Klipper not connected", () => {
    const snap = baseSnap({
      status: "error",
      raw: {
        server: {
          klippy_connected: false,
          klippy_state: "disconnected",
          moonraker_version: "v1",
        },
        webhooks_state: "ready",
      },
      printerInfo: { state_message: "Klippy disconnected" },
    });
    expect(resolvePrinterStatusTooltip(snap, "error")).toEqual({
      i18nKey: "printer.statusHint.klippyNotConnected",
      detail: "Klippy disconnected",
    });
  });

  it("error webhook shutdown wins over klippy", () => {
    const snap = baseSnap({
      status: "error",
      raw: {
        server: {
          klippy_connected: false,
          klippy_state: "ready",
          moonraker_version: "v1",
        },
        webhooks_state: "shutdown",
      },
    });
    expect(resolvePrinterStatusTooltip(snap, "error")?.i18nKey).toBe("printer.statusHint.webhookBad");
  });

  it("printing with filename", () => {
    const snap = baseSnap({
      status: "printing",
      isActivelyPrinting: true,
      printFilename: "a.gcode",
      raw: { print_stats: { state: "printing", filename: "a.gcode" } },
    });
    expect(resolvePrinterStatusTooltip(snap, "printing")).toEqual({
      i18nKey: "printer.statusHint.printingFile",
      i18nParams: { file: "a.gcode" },
    });
  });
});

describe("formatStatusTooltipTitle", () => {
  it("joins detail with em dash", () => {
    const s = formatStatusTooltipTitle(
      {
        i18nKey: "printer.statusHint.klippyNotConnected",
        detail: "API msg",
      },
      (key) => (key === "printer.statusHint.klippyNotConnected" ? "Main" : key),
    );
    expect(s).toBe("Main — API msg");
  });
});
