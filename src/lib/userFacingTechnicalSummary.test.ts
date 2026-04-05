import { describe, expect, it } from "vitest";
import { userFacingTechnicalSummary } from "./userFacingTechnicalSummary";

describe("userFacingTechnicalSummary", () => {
  it("takes first line and reports multiline", () => {
    const r = userFacingTechnicalSummary("line one\nline two");
    expect(r.line).toBe("line one");
    expect(r.hasMore).toBe(true);
  });

  it("truncates long first line", () => {
    const r = userFacingTechnicalSummary("x".repeat(250), 10);
    expect(r.line.length).toBe(10);
    expect(r.line.endsWith("…")).toBe(true);
    expect(r.hasMore).toBe(true);
  });
});
