import { describe, expect, it } from "vitest";
import { compareNetworkSamples, parseIpLinkCounters } from "./healthNetworkHeuristic";

describe("healthNetworkHeuristic", () => {
  it("parses counters from ip -s style snippet", () => {
    const t = "RX errors: 2\nTX errors: 1";
    const c = parseIpLinkCounters(t);
    expect(c.rxErr).toBeGreaterThanOrEqual(2);
  });

  it("detects worsening drops", () => {
    const a = "RX errors: 0\ndropped: 1";
    const b = "RX errors: 0\ndropped: 5";
    const r = compareNetworkSamples(a, b);
    expect(r.kind).toBe("warn");
  });
});
