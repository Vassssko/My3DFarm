/**
 * Parse leading X.Y.Z from Klipper/Moonraker-style strings (git describe or tag).
 * Examples: `v0.13.0-595-gabc`, `0.9.3-12-gmock`, `v0.10.0`.
 */
export type SemverTriple = { major: number; minor: number; patch: number };

const TRIPLE_PREFIX = /^v?(\d+)\.(\d+)\.(\d+)/i;

export function parseSemverPrefix(version: string): SemverTriple | null {
  const s = version.trim();
  if (!s || s === "—") {
    return null;
  }
  const m = s.match(TRIPLE_PREFIX);
  if (!m) {
    return null;
  }
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

/** Strict tag name: `v0.10.0` (rejects junk like `v.08`). */
const TAG_TRIPLE = /^v?(\d+)\.(\d+)\.(\d+)$/i;

export function parseSemverTagName(tagName: string): SemverTriple | null {
  const s = tagName.trim();
  const m = s.match(TAG_TRIPLE);
  if (!m) {
    return null;
  }
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

export function compareSemverTriple(a: SemverTriple, b: SemverTriple): number {
  if (a.major !== b.major) {
    return a.major - b.major;
  }
  if (a.minor !== b.minor) {
    return a.minor - b.minor;
  }
  return a.patch - b.patch;
}

/**
 * True if the printer-reported version is strictly older than the newest tag on GitHub
 * (semver of base tag / describe prefix).
 */
export function isDeviceVersionBehindTag(deviceVersion: string, newestTagName: string | null): boolean {
  if (!newestTagName) {
    return false;
  }
  const loc = parseSemverPrefix(deviceVersion);
  const rem = parseSemverTagName(newestTagName);
  if (!loc || !rem) {
    return false;
  }
  return compareSemverTriple(loc, rem) < 0;
}

/** Pick the highest X.Y.Z tag from a list of Git tag names. */
export function pickHighestSemverTag(tagNames: string[]): string | null {
  let best: { triple: SemverTriple; name: string } | null = null;
  for (const name of tagNames) {
    const triple = parseSemverTagName(name);
    if (!triple) {
      continue;
    }
    if (!best || compareSemverTriple(triple, best.triple) > 0) {
      best = { triple, name };
    }
  }
  return best?.name ?? null;
}
