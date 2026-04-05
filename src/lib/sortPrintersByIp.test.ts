import { describe, expect, it } from "vitest";
import { sortSavedPrintersByIp } from "./sortPrintersByIp";

function p(id: string, baseUrl: string) {
  return { id, baseUrl, displayName: id };
}

describe("sortSavedPrintersByIp", () => {
  it("sorts IPv4 numerically, not lexicographically", () => {
    const sorted = sortSavedPrintersByIp([
      p("a", "http://192.168.1.120:7125"),
      p("b", "http://192.168.1.20:7125"),
      p("c", "http://10.0.0.2:7125"),
    ]);
    expect(sorted.map((x) => x.id)).toEqual(["c", "b", "a"]);
  });

  it("places IPv4 before non-IPv4 hostnames", () => {
    const sorted = sortSavedPrintersByIp([
      p("h", "http://printer.local:7125"),
      p("i", "http://192.168.0.1:7125"),
    ]);
    expect(sorted.map((x) => x.id)).toEqual(["i", "h"]);
  });

  it("sorts hostnames alphabetically", () => {
    const sorted = sortSavedPrintersByIp([
      p("x", "http://zebra.local:7125"),
      p("y", "http://alpha.local:7125"),
    ]);
    expect(sorted.map((x) => x.id)).toEqual(["y", "x"]);
  });
});
