/**
 * Run at most one `buildPrinterSnapshot` (full Moonraker poll) at a time app-wide,
 * so a large grid does not open many concurrent connections to the LAN.
 */
let chain: Promise<unknown> = Promise.resolve();

export function enqueueFleetSnapshot<T>(fn: () => Promise<T>): Promise<T> {
  const run = () => fn();
  const next = chain.then(run, run);
  chain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}
