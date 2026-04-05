import { describe, expect, it } from "vitest";
import { parseKlipperConfigSections, summarizeHardware } from "./parseKlipperConfigSections";

describe("parseKlipperConfigSections", () => {
  it("parses mcu and temperature_sensor", () => {
    const cfg = `[mcu]\nserial: /dev/ttyAMA0\n\n[temperature_sensor chamber]\nsensor_type: ATC Semitec 104GT-2\n`;
    const s = parseKlipperConfigSections(cfg);
    const h = summarizeHardware(s);
    expect(h.mcus[0]?.serial).toBe("/dev/ttyAMA0");
    expect(h.tempSensors.some((t) => t.section.includes("chamber"))).toBe(true);
  });
});
