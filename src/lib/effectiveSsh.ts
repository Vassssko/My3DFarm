import type { SavedPrinter } from "../store/printerStore";

export function hostFromMoonrakerBaseUrl(baseUrl: string): string {
  try {
    return new URL(baseUrl).hostname;
  } catch {
    return baseUrl;
  }
}

export type SshGlobals = {
  defaultSshUser: string;
  defaultSshPort: number;
  applyHostHintToUsername: boolean;
};

export type EffectiveSsh = {
  host: string;
  port: number;
  user: string;
  matchedHintId: string | null;
};

export function resolveEffectiveSsh(
  printer: SavedPrinter,
  globals: SshGlobals,
  hint: { id: string; suggestedUsername: string } | null,
): EffectiveSsh {
  const host = (printer.sshHost?.trim() || hostFromMoonrakerBaseUrl(printer.baseUrl)).trim();
  const port = printer.sshPort ?? globals.defaultSshPort;
  const userOverride = printer.sshUser?.trim();
  let user = (userOverride || globals.defaultSshUser || "pi").trim();
  let matchedHintId: string | null = null;
  if (!userOverride && globals.applyHostHintToUsername && hint) {
    user = hint.suggestedUsername;
    matchedHintId = hint.id;
  }
  return { host, port, user, matchedHintId };
}

/** Effective SSH using only global defaults + Moonraker host (no per-printer overrides). */
export function resolveEffectiveSshGlobalsOnly(
  printer: Pick<SavedPrinter, "baseUrl">,
  globals: SshGlobals,
  hint: { id: string; suggestedUsername: string } | null,
): EffectiveSsh {
  const host = hostFromMoonrakerBaseUrl(printer.baseUrl).trim();
  const port = globals.defaultSshPort;
  let user = (globals.defaultSshUser || "pi").trim();
  let matchedHintId: string | null = null;
  if (globals.applyHostHintToUsername && hint) {
    user = hint.suggestedUsername;
    matchedHintId = hint.id;
  }
  return { host, port, user, matchedHintId };
}
