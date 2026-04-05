import { postMachineUpdateUpgrade } from "../moonraker/client";
import { fetchPrinterOperationalState } from "../moonraker/snapshot";
import type { SavedPrinter } from "../store/printerStore";

export type BulkUpgradeResult = { ok: number; skipped: number; failed: number };

/** Full Moonraker upgrade sequence on each host (Klipper → Moonraker order on server). */
export async function bulkFullMoonrakerUpgradeIdleOnly(
  printers: SavedPrinter[],
  selectedIds: Set<string>,
): Promise<BulkUpgradeResult> {
  let ok = 0;
  let skipped = 0;
  let failed = 0;
  for (const p of printers) {
    if (!selectedIds.has(p.id)) {
      continue;
    }
    const op = await fetchPrinterOperationalState(p.baseUrl, p.apiKey);
    if (!op.reachable || !op.isIdleReady) {
      skipped++;
      continue;
    }
    try {
      await postMachineUpdateUpgrade(p.baseUrl, p.apiKey);
      ok++;
    } catch {
      failed++;
    }
  }
  return { ok, skipped, failed };
}

/** APT / system packages only (Moonraker `system` updater). */
export async function bulkSystemPackagesUpgradeIdleOnly(
  printers: SavedPrinter[],
  selectedIds: Set<string>,
): Promise<BulkUpgradeResult> {
  let ok = 0;
  let skipped = 0;
  let failed = 0;
  for (const p of printers) {
    if (!selectedIds.has(p.id)) {
      continue;
    }
    const op = await fetchPrinterOperationalState(p.baseUrl, p.apiKey);
    if (!op.reachable || !op.isIdleReady) {
      skipped++;
      continue;
    }
    try {
      await postMachineUpdateUpgrade(p.baseUrl, p.apiKey, "system");
      ok++;
    } catch {
      failed++;
    }
  }
  return { ok, skipped, failed };
}
