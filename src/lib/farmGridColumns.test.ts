import { describe, expect, it } from "vitest";
import { getFarmGridColumns } from "./farmGridColumns";

describe("getFarmGridColumns", () => {
  it("matches farm grid breakpoints", () => {
    expect(getFarmGridColumns(400)).toBe(1);
    expect(getFarmGridColumns(420)).toBe(2);
    expect(getFarmGridColumns(700)).toBe(2);
    expect(getFarmGridColumns(800)).toBe(3);
    expect(getFarmGridColumns(1100)).toBe(4);
    expect(getFarmGridColumns(1300)).toBe(6);
    expect(getFarmGridColumns(1600)).toBe(8);
  });
});
