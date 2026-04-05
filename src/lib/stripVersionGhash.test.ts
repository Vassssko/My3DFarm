import { describe, expect, it } from "vitest";
import { stripVersionGhash } from "./stripVersionGhash";

describe("stripVersionGhash", () => {
  it("removes trailing -g<hex>", () => {
    expect(stripVersionGhash("v0.12.0-123-gabcdef1")).toBe("v0.12.0-123");
    expect(stripVersionGhash("v0.9.1-gABCDEF0")).toBe("v0.9.1");
  });

  it("leaves strings without ghash", () => {
    expect(stripVersionGhash("v2.1.1")).toBe("v2.1.1");
    expect(stripVersionGhash("")).toBe("");
  });
});
