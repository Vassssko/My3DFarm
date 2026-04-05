/**
 * Very light parsing of `ip -s link` output: sum RX/TX error-like tokens for trend messaging.
 */

function sumMatches(re: RegExp, text: string): number {
  let n = 0;
  for (const m of text.matchAll(re)) {
    const v = Number(m[1]);
    if (Number.isFinite(v)) {
      n += v;
    }
  }
  return n;
}

export function parseIpLinkCounters(text: string): { rxErr: number; txErr: number; drops: number } {
  const rxErr = sumMatches(/\bRX errors:\s*(\d+)/gi, text) + sumMatches(/\berrors\s+(\d+)/gi, text);
  const txErr = sumMatches(/\bTX errors:\s*(\d+)/gi, text);
  const drops =
    sumMatches(/\bdropped:?\s*(\d+)/gi, text) +
    sumMatches(/\bdrop[s]?:\s*(\d+)/gi, text);
  return { rxErr, txErr, drops };
}

export type HealthTrendHint =
  | { kind: "ok"; messageKey: "hub.healthTrendOk" }
  | { kind: "warn"; messageKey: "hub.healthTrendDegrading"; detail?: string };

export function compareNetworkSamples(prevRaw: string, nextRaw: string): HealthTrendHint {
  const a = parseIpLinkCounters(prevRaw);
  const b = parseIpLinkCounters(nextRaw);
  const dDrop = b.drops - a.drops;
  const dErr = b.rxErr + b.txErr - (a.rxErr + a.txErr);
  if (dDrop > 0 || dErr > 0) {
    return {
      kind: "warn",
      messageKey: "hub.healthTrendDegrading",
      detail: `+drops ${dDrop}, +err ${dErr}`,
    };
  }
  return { kind: "ok", messageKey: "hub.healthTrendOk" };
}
