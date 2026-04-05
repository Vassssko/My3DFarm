export type KlipperSection = {
  name: string;
  params: Record<string, string>;
};

/** Minimal INI-style section parse (Klipper config without heavy validation). */
export function parseKlipperConfigSections(configText: string): KlipperSection[] {
  const sections: KlipperSection[] = [];
  let current: KlipperSection | null = null;
  for (const rawLine of configText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) {
      continue;
    }
    const sec = line.match(/^\[([^\]]+)\]\s*$/);
    if (sec) {
      current = { name: sec[1].trim(), params: {} };
      sections.push(current);
      continue;
    }
    if (!current) {
      continue;
    }
    const eq = line.indexOf("=");
    const col = line.indexOf(":");
    let key: string;
    let val: string;
    if (eq > 0 && (col < 0 || eq < col)) {
      key = line.slice(0, eq).trim();
      val = line.slice(eq + 1).trim();
    } else if (col > 0) {
      key = line.slice(0, col).trim();
      val = line.slice(col + 1).trim();
    } else {
      continue;
    }
    if (key) {
      current.params[key] = val;
    }
  }
  return sections;
}

export type HardwareSummary = {
  mcus: Array<{ section: string; serial?: string; canbusUuid?: string; restartMethod?: string }>;
  tempSensors: Array<{ section: string; sensorType?: string }>;
};

export function summarizeHardware(sections: KlipperSection[]): HardwareSummary {
  const mcus: HardwareSummary["mcus"] = [];
  const tempSensors: HardwareSummary["tempSensors"] = [];
  for (const s of sections) {
    if (s.name.startsWith("mcu")) {
      mcus.push({
        section: s.name,
        serial: s.params.serial,
        canbusUuid: s.params.canbus_uuid,
        restartMethod: s.params.restart_method,
      });
    }
    if (s.name.startsWith("temperature_sensor") || s.name === "extruder" || s.name === "heater_bed") {
      tempSensors.push({
        section: s.name,
        sensorType: s.params.sensor_type,
      });
    }
  }
  return { mcus, tempSensors };
}
