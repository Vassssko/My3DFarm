import { describe, expect, it } from "vitest";
import { analyzeKlipperLogLines } from "./klipperLogHeuristics";

describe("klipperLogHeuristics", () => {
  it("flags lost mcu line", () => {
    const f = analyzeKlipperLogLines("Lost communication with MCU 'mcu'");
    expect(f.some((x) => x.code === "lost_mcu")).toBe(true);
  });
});
