import { describe, expect, it } from "vitest";
import { extractResolvedConfigFromKlipperLog } from "./extractKlipperConfigFromLog";

describe("extractResolvedConfigFromKlipperLog", () => {
  it("extracts after Loaded configuration banner", () => {
    const log = `
blah
===============\nLoaded configuration (99 bytes)\n===============\n[mcu]\nserial: /dev/ttyUSB0\n\n===============\n`;
    const r = extractResolvedConfigFromKlipperLog(log);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.text).toContain("[mcu]");
      expect(r.text).toContain("serial:");
    }
  });
});
