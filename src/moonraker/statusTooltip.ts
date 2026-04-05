import type { CardStatus, PrinterSnapshot } from "./snapshot";

/** Display status on the card (includes dirty-build overlay). */
export type PrinterCardHeaderStatus = CardStatus | "dirtyBuild";

export type StatusTooltipResolved = {
  i18nKey: string;
  i18nParams?: Record<string, string>;
  /** Extra line from Moonraker (often English). */
  detail?: string;
};

/**
 * Tooltip text when the card is not in a plain ready state.
 * Order follows `deriveCardStatus` so the message matches the red/yellow badge.
 */
export function resolvePrinterStatusTooltip(
  snap: PrinterSnapshot,
  headerStatus: PrinterCardHeaderStatus,
): StatusTooltipResolved | null {
  if (headerStatus === "ready") {
    return null;
  }

  if (headerStatus === "dirtyBuild") {
    return { i18nKey: "printer.statusHint.dirtyBuild" };
  }

  const server = snap.raw.server;
  const wh = snap.raw.webhooks_state;
  const detail = snap.printerInfo?.state_message?.trim();

  if (snap.status === "offline") {
    if (snap.offlineDetail === "auth") {
      return { i18nKey: "printer.statusHint.offlineAuth" };
    }
    if (snap.offlineDetail === "unreachable") {
      return { i18nKey: "printer.statusHint.offlineUnreachable" };
    }
    if (snap.offlineDetail === "http") {
      return {
        i18nKey: "printer.statusHint.offlineHttp",
        i18nParams: { status: String(snap.httpStatus ?? 0) },
      };
    }
    return { i18nKey: "printer.statusHint.offlineGeneric" };
  }

  if (snap.status === "error") {
    if (wh === "error" || wh === "shutdown") {
      return {
        i18nKey: "printer.statusHint.webhookBad",
        i18nParams: { state: wh },
        detail: detail || undefined,
      };
    }
    if (server?.klippy_connected === false) {
      return {
        i18nKey: "printer.statusHint.klippyNotConnected",
        detail: detail || undefined,
      };
    }
    const ks = server?.klippy_state;
    if (ks === "error" || ks === "shutdown") {
      return {
        i18nKey: "printer.statusHint.klippyBad",
        i18nParams: { state: ks },
        detail: detail || undefined,
      };
    }
    return {
      i18nKey: "printer.statusHint.errorUnknown",
      detail: detail || undefined,
    };
  }

  if (snap.status === "printing") {
    if (snap.isActivelyPrinting) {
      const file = snap.printFilename ?? "";
      const ps = snap.raw.print_stats?.state;
      if (ps === "paused") {
        return {
          i18nKey: "printer.statusHint.printingPaused",
          i18nParams: { file },
        };
      }
      return {
        i18nKey: "printer.statusHint.printingFile",
        i18nParams: { file },
      };
    }
    const ks = server?.klippy_state ?? "unknown";
    return {
      i18nKey: "printer.statusHint.klippyBusy",
      i18nParams: { state: ks },
      detail: detail || undefined,
    };
  }

  return null;
}

export function formatStatusTooltipTitle(
  resolved: StatusTooltipResolved,
  t: (key: string, options?: Record<string, string>) => string,
): string {
  const main = t(resolved.i18nKey, resolved.i18nParams);
  if (resolved.detail) {
    return `${main} — ${resolved.detail}`;
  }
  return main;
}
