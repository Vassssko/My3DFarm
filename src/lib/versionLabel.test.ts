import { describe, expect, it } from "vitest";
import { isDirtyVersion, stripVersionForDisplay } from "./versionLabel";

describe("stripVersionForDisplay", () => {
  it("removes trailing -g<hex>", () => {
    expect(stripVersionForDisplay("v0.13.0-595-gb0e6ca45")).toBe("v0.13.0-595");
    expect(stripVersionForDisplay("v0.10.0-19-g1ed102e")).toBe("v0.10.0-19");
  });

  it("removes -dirty after ghash tail", () => {
    expect(stripVersionForDisplay("v0.13.0-595-gb0e6ca45f-dirty")).toBe("v0.13.0-595");
    expect(stripVersionForDisplay("v0.13.0-595-gB0E6CA45F-DIRTY")).toBe("v0.13.0-595");
  });

  it("removes -dirty without ghash", () => {
    expect(stripVersionForDisplay("v0.13.0-dirty")).toBe("v0.13.0");
  });

  it("leaves clean versions unchanged", () => {
    expect(stripVersionForDisplay("v0.13.0")).toBe("v0.13.0");
    expect(stripVersionForDisplay("v0.13.0-595")).toBe("v0.13.0-595");
  });

  it("trims whitespace", () => {
    expect(stripVersionForDisplay("  v1.0.0-1-gabc  ")).toBe("v1.0.0-1");
  });
});

describe("isDirtyVersion", () => {
  it("detects -dirty suffix", () => {
    expect(isDirtyVersion("v0.13.0-595-gb0e6ca45f-dirty")).toBe(true);
    expect(isDirtyVersion("v0.1-DIRTY")).toBe(true);
  });

  it("is false without dirty suffix", () => {
    expect(isDirtyVersion("v0.13.0-595-gb0e6ca45f")).toBe(false);
    expect(isDirtyVersion("v0.13.0-595")).toBe(false);
  });
});
