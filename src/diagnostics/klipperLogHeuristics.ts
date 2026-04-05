export type LogFindingSeverity = "info" | "warn" | "error";

export type LogFinding = {
  code: string;
  severity: LogFindingSeverity;
  messageKey: string;
  excerpt?: string;
};

type Rule = {
  code: string;
  severity: LogFindingSeverity;
  messageKey: string;
  test: (line: string) => boolean;
};

const RULES: Rule[] = [
  {
    code: "lost_mcu",
    severity: "error",
    messageKey: "hub.logFinding.lostMcu",
    test: (l) => /lost communication with mcu/i.test(l) || /lost connection to mcu/i.test(l),
  },
  {
    code: "timer_too_close",
    severity: "error",
    messageKey: "hub.logFinding.timerTooClose",
    test: (l) => /timer too close/i.test(l),
  },
  {
    code: "homing_timeout",
    severity: "error",
    messageKey: "hub.logFinding.homingTimeout",
    test: (l) => /timeout during homing/i.test(l) || /timeout during probe/i.test(l),
  },
  {
    code: "tmc_undervoltage",
    severity: "warn",
    messageKey: "hub.logFinding.tmcUndervoltage",
    test: (l) => /tmc.*undervoltage/i.test(l) || /tmc.*reset/i.test(l),
  },
  {
    code: "can_bus_off",
    severity: "warn",
    messageKey: "hub.logFinding.canBusOff",
    test: (l) => /bus-off/i.test(l) || /canbus.*error/i.test(l),
  },
  {
    code: "shutdown",
    severity: "error",
    messageKey: "hub.logFinding.shutdown",
    test: (l) => /transition to shutdown state/i.test(l) || /klipper state: shutdown/i.test(l),
  },
];

export function analyzeKlipperLogLines(logText: string): LogFinding[] {
  const lines = logText.split(/\r?\n/);
  const seen = new Set<string>();
  const out: LogFinding[] = [];
  for (const line of lines) {
    for (const r of RULES) {
      if (!r.test(line)) {
        continue;
      }
      const key = `${r.code}:${line.slice(0, 120)}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      out.push({
        code: r.code,
        severity: r.severity,
        messageKey: r.messageKey,
        excerpt: line.trim().slice(0, 240),
      });
    }
  }
  return out;
}
