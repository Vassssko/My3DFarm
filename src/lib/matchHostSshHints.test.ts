import { describe, expect, it } from "vitest";
import { haystackFromSystemInfo, matchHostSshHint } from "./matchHostSshHints";

describe("matchHostSshHints", () => {
  it("matches Raspberry Pi style cpu description", () => {
    const si = {
      system_info: {
        cpu_info: { hardware_description: "BCM2711 Raspberry Pi 4" },
      },
    };
    const h = matchHostSshHint(si);
    expect(h?.suggestedUsername).toBe("pi");
  });

  it("matches haystackFromSystemInfo lowercase", () => {
    const hay = haystackFromSystemInfo({ CPU: "Orange Pi" });
    expect(hay).toContain("orange");
  });
});
