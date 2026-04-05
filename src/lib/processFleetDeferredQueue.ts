import { postMachineUpdateUpgrade } from "../moonraker/client";
import { fetchPrinterOperationalState } from "../moonraker/snapshot";
import { useFleetDeferredUpdateStore } from "../store/fleetDeferredUpdateStore";
import { useFleetInventoryStore } from "../store/fleetInventoryStore";
import type { SavedPrinter } from "../store/printerStore";

/**
 * Try one deferred full upgrade per tick for printers that are idle and still show pending software.
 */
export async function processFleetDeferredQueue(printers: SavedPrinter[]): Promise<void> {
  const { queuedIds, remove } = useFleetDeferredUpdateStore.getState();
  if (queuedIds.length === 0) {
    return;
  }
  const byId = new Map(printers.map((p) => [p.id, p]));

  for (const pid of [...queuedIds]) {
    const p = byId.get(pid);
    if (!p) {
      remove(pid);
      continue;
    }
    const op = await fetchPrinterOperationalState(p.baseUrl, p.apiKey);
    if (!op.reachable || !op.isIdleReady) {
      continue;
    }
    const inv = useFleetInventoryStore.getState().byId[pid];
    const pending =
      (inv?.managedSoftwareUpdates ?? 0) > 0 || (inv?.hostPackagesPending ?? 0) > 0;
    if (!pending) {
      remove(pid);
      continue;
    }
    try {
      await postMachineUpdateUpgrade(p.baseUrl, p.apiKey);
      remove(pid);
      void useFleetInventoryStore.getState().refreshPrinters([p], 1);
    } catch {
      /* keep in queue */
    }
    break;
  }
}
