import { create } from "zustand";
import { persist } from "zustand/middleware";
import { sortSavedPrintersByIp } from "../lib/sortPrintersByIp";
import { normalizeBaseUrl } from "../moonraker/client";

export type SavedPrinter = {
  id: string;
  baseUrl: string;
  apiKey?: string;
  displayName?: string;
};

type PrinterState = {
  printers: SavedPrinter[];
  /**
   * Printer ids added via discovery / direct add while editing — staged until the user taps the green
   * plus button or leaves edit mode (unconfirmed printers are removed on Done). Not persisted.
   */
  newFromDiscoveryIds: string[];
  discoveryOpen: boolean;
  setDiscoveryOpen: (open: boolean) => void;
  gridEditMode: boolean;
  setGridEditMode: (on: boolean) => void;
  /** Removes id from staging so Done keeps this printer in the farm. */
  confirmDiscoveryPrinter: (id: string) => void;
  /**
   * Existing printers marked with the red badge in edit mode; removed from the farm on Done unless
   * the user taps the green plus to cancel. Not persisted.
   */
  pendingRemovalIds: string[];
  togglePendingRemoval: (id: string) => void;
  /**
   * After Done: printers marked for removal stay in `printers` while they play the fly-out animation;
   * then `completeRemovalExit` drops them. Not persisted.
   */
  removalExitIds: string[];
  completeRemovalExit: () => void;
  addPrinters: (items: Omit<SavedPrinter, "id">[]) => void;
  removePrinter: (id: string) => void;
  updatePrinter: (id: string, patch: Partial<SavedPrinter>) => void;
};

export const usePrinterStore = create<PrinterState>()(
  persist(
    (set) => ({
      printers: [],
      newFromDiscoveryIds: [],
      pendingRemovalIds: [],
      removalExitIds: [],
      discoveryOpen: false,
      setDiscoveryOpen: (open) => set({ discoveryOpen: open }),
      gridEditMode: false,
      setGridEditMode: (on) =>
        set((s) => {
          if (on) {
            return { gridEditMode: true, removalExitIds: [] };
          }
          const dropNew = new Set(s.newFromDiscoveryIds);
          const toFlyOut = [...s.pendingRemovalIds];
          return {
            gridEditMode: false,
            newFromDiscoveryIds: [],
            pendingRemovalIds: [],
            removalExitIds: toFlyOut,
            printers: sortSavedPrintersByIp(s.printers.filter((p) => !dropNew.has(p.id))),
          };
        }),
      completeRemovalExit: () =>
        set((s) => {
          const drop = new Set(s.removalExitIds);
          if (drop.size === 0) {
            return {};
          }
          return {
            removalExitIds: [],
            printers: sortSavedPrintersByIp(s.printers.filter((p) => !drop.has(p.id))),
          };
        }),
      confirmDiscoveryPrinter: (id) =>
        set((s) => ({
          newFromDiscoveryIds: s.newFromDiscoveryIds.filter((x) => x !== id),
        })),
      togglePendingRemoval: (id) =>
        set((s) => {
          const has = s.pendingRemovalIds.includes(id);
          return {
            pendingRemovalIds: has
              ? s.pendingRemovalIds.filter((x) => x !== id)
              : [...s.pendingRemovalIds, id],
          };
        }),
      addPrinters: (items) =>
        set((s) => {
          const existing = new Set(s.printers.map((p) => normalizeBaseUrl(p.baseUrl)));
          const fresh = items.filter((it) => !existing.has(normalizeBaseUrl(it.baseUrl)));
          if (fresh.length === 0) {
            return { discoveryOpen: false };
          }
          const added = fresh.map((it) => ({
            ...it,
            id: crypto.randomUUID(),
          }));
          return {
            printers: sortSavedPrintersByIp([...s.printers, ...added]),
            discoveryOpen: false,
            newFromDiscoveryIds: s.gridEditMode
              ? [...s.newFromDiscoveryIds, ...added.map((p) => p.id)]
              : s.newFromDiscoveryIds,
          };
        }),
      removePrinter: (id) =>
        set((s) => ({
          printers: sortSavedPrintersByIp(s.printers.filter((p) => p.id !== id)),
          newFromDiscoveryIds: s.newFromDiscoveryIds.filter((x) => x !== id),
          pendingRemovalIds: s.pendingRemovalIds.filter((x) => x !== id),
          removalExitIds: s.removalExitIds.filter((x) => x !== id),
        })),
      updatePrinter: (id, patch) =>
        set((s) => ({
          printers: sortSavedPrintersByIp(
            s.printers.map((p) => (p.id === id ? { ...p, ...patch } : p)),
          ),
        })),
    }),
    {
      name: "my3dfarm-printers",
      merge: (persistedState, currentState) => {
        const p = persistedState as Partial<Pick<PrinterState, "printers">> | undefined;
        return {
          ...currentState,
          ...p,
          printers: sortSavedPrintersByIp(p?.printers ?? currentState.printers),
        };
      },
      partialize: (s) => ({ printers: s.printers }),
    },
  ),
);
