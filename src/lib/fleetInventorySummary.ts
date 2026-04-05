import { extractHostOsFromSystemInfo } from "./machineSystemInfoDisplay";
import {
  getMoonrakerSystemPackageCount,
  listSoftwareUpdaters,
} from "./moonrakerSoftwareUpdaters";
import type { MoonrakerMachineUpdateStatus } from "../moonraker/types";

export type FleetInventorySummary = {
  hostPackagesPending: number | null;
  managedSoftwareUpdates: number;
  pendingModuleKeys: string[];
  osLine: string | null;
};

export function summarizeFleetInventory(
  updateStatus: MoonrakerMachineUpdateStatus | null,
  systemInfo: unknown,
): FleetInventorySummary {
  const vi = updateStatus?.version_info;
  const rows = listSoftwareUpdaters(vi);
  const pendingModuleKeys = rows.filter((r) => r.needsUpdate).map((r) => r.key);
  const { distributionLine } = extractHostOsFromSystemInfo(systemInfo);
  return {
    hostPackagesPending: getMoonrakerSystemPackageCount(vi),
    managedSoftwareUpdates: pendingModuleKeys.length,
    pendingModuleKeys,
    osLine: distributionLine,
  };
}
