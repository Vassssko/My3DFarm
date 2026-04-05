/**
 * Extract the flat resolved config block Klipper writes to klippy.log (markers vary by version).
 */

const END_MARKERS = [
  /\n={10,}\s*\n/g,
  /\n-{10,}\s*$/m,
];

export type ExtractConfigResult =
  | { ok: true; text: string }
  | { ok: false; reason: "not_found" | "empty" };

export function extractResolvedConfigFromKlipperLog(logText: string): ExtractConfigResult {
  const lower = logText.toLowerCase();
  let startIdx = -1;
  if (lower.includes("loaded configuration")) {
    const m = logText.match(/={3,}[^=\n]*[Ll]oaded configuration[^=\n]*={3,}\s*\n/);
    if (m?.index !== undefined) {
      startIdx = m.index + m[0].length;
    }
  }
  if (startIdx < 0) {
    const alt = logText.search(/\n\[mcu[^\]]*\]\s*\n/i);
    if (alt >= 0) {
      startIdx = alt + 1;
    }
  }
  if (startIdx < 0) {
    return { ok: false, reason: "not_found" };
  }

  let slice = logText.slice(startIdx);
  for (const re of END_MARKERS) {
    const m = re.exec(slice);
    if (m?.index !== undefined && m.index > 200) {
      slice = slice.slice(0, m.index);
      break;
    }
  }

  const text = slice.trim();
  if (text.length < 30) {
    return { ok: false, reason: "empty" };
  }
  return { ok: true, text };
}
