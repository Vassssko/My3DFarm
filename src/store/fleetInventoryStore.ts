import { create } from "zustand";
import { persist } from "zustand/middleware";
import { summarizeFleetInventory } from "../lib/fleetInventorySummary";
import { runWithConcurrency } from "../lib/runWithConcurrency";
import { fetchMachineSystemInfo, fetchMachineUpdateStatus } from "../moonraker/client";
import type { SavedPrinter } from "./printerStore";

export type FleetInventoryEntry = {
  fetchedAt: number;
  reachable: boolean;
  hostPackagesPending: number | null;
  managedSoftwareUpdates: number;
  pendingModuleKeys: string[];
  osLine: string | null;
  error: string | null;
};

type FleetInventoryState = {
  byId: Record<string, FleetInventoryEntry>;
  refreshRunning: boolean;
  lastFleetRefreshAt: number | null;
  refreshPrinters: (printers: SavedPrinter[], concurrency?: number) => Promise<void>;
};

export const useFleetInventoryStore = create<FleetInventoryState>()(
  persist(
    (set) => ({
      byId: {},
      refreshRunning: false,
      lastFleetRefreshAt: null,
      refreshPrinters: async (printers, concurrency = 5) => {
        if (printers.length === 0) {
          return;
        }
        set({ refreshRunning: true });
        try {
          await runWithConcurrency(printers, concurrency, async (p) => {
            try {
              const [us, si] = await Promise.all([
                fetchMachineUpdateStatus(p.baseUrl, p.apiKey),
                fetchMachineSystemInfo(p.baseUrl, p.apiKey),
              ]);
              const sum = summarizeFleetInventory(us, si);
              const entry: FleetInventoryEntry = {
                fetchedAt: Date.now(),
                reachable: true,
                hostPackagesPending: sum.hostPackagesPending,
                managedSoftwareUpdates: sum.managedSoftwareUpdates,
                pendingModuleKeys: sum.pendingModuleKeys,
                osLine: sum.osLine,
                error: null,
              };
              set((s) => ({ byId: { ...s.byId, [p.id]: entry } }));
            } catch (e) {
              const err = e instanceof Error ? e.message : String(e);
              const entry: FleetInventoryEntry = {
                fetchedAt: Date.now(),
                reachable: false,
                hostPackagesPending: null,
                managedSoftwareUpdates: 0,
                pendingModuleKeys: [],
                osLine: null,
                error: err,
              };
              set((s) => ({ byId: { ...s.byId, [p.id]: entry } }));
            }
          });
          set({ lastFleetRefreshAt: Date.now() });
        } finally {
          set({ refreshRunning: false });
        }
      },
    }),
    { name: "my3dfarm-fleet-inventory" },
  ),
);
