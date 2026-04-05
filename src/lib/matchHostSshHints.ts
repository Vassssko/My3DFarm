import bundled from "../data/hostSshHints.json";

export type HostSshHintEntry = {
  id: string;
  labelKey: string;
  priority: number;
  match: { hayIncludesAll: string[] };
  suggestedUsername: string;
};

export type HostSshHintsFile = {
  schemaVersion: number;
  entries: HostSshHintEntry[];
};

function isHintsFile(x: unknown): x is HostSshHintsFile {
  if (x === null || typeof x !== "object") {
    return false;
  }
  const o = x as Record<string, unknown>;
  return Array.isArray(o.entries);
}

export function haystackFromSystemInfo(systemInfo: unknown): string {
  try {
    return JSON.stringify(systemInfo ?? {}).toLowerCase();
  } catch {
    return "";
  }
}

/** Merge bundled hints with optional user overlay (same shape JSON). */
export function loadMergedHints(overlay?: unknown): HostSshHintEntry[] {
  const base = (bundled as HostSshHintsFile).entries;
  if (!overlay || !isHintsFile(overlay)) {
    return [...base].sort((a, b) => b.priority - a.priority);
  }
  const byId = new Map<string, HostSshHintEntry>();
  for (const e of base) {
    byId.set(e.id, e);
  }
  for (const e of overlay.entries) {
    byId.set(e.id, e);
  }
  return [...byId.values()].sort((a, b) => b.priority - a.priority);
}

export function matchHostSshHint(
  systemInfo: unknown,
  extraEntries: HostSshHintEntry[] = [],
): HostSshHintEntry | null {
  const hay = haystackFromSystemInfo(systemInfo);
  if (!hay) {
    return null;
  }
  const entries = [...loadMergedHints(), ...extraEntries].sort((a, b) => b.priority - a.priority);
  for (const e of entries) {
    const all = e.match.hayIncludesAll;
    if (all.every((frag) => hay.includes(frag.toLowerCase()))) {
      return e;
    }
  }
  return null;
}
