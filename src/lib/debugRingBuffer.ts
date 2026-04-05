export type DebugEvent = {
  t: number;
  kind: string;
  message: string;
  detail?: unknown;
};

const MAX = 80;
const buf: DebugEvent[] = [];

export function pushDebugEvent(e: Omit<DebugEvent, "t"> & { t?: number }): void {
  buf.push({
    t: e.t ?? Date.now(),
    kind: e.kind,
    message: e.message,
    detail: e.detail,
  });
  while (buf.length > MAX) {
    buf.shift();
  }
}

export function getDebugEvents(): DebugEvent[] {
  return [...buf];
}

export function clearDebugEvents(): void {
  buf.length = 0;
}
