import { create } from "zustand";

/**
 * Printers that should receive a full Moonraker-managed upgrade once idle.
 * Processed periodically from the farm view (see `processFleetDeferredQueue`).
 */
type FleetDeferredState = {
  queuedIds: string[];
  enqueue: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
};

export const useFleetDeferredUpdateStore = create<FleetDeferredState>((set) => ({
  queuedIds: [],
  enqueue: (id) =>
    set((s) => (s.queuedIds.includes(id) ? s : { queuedIds: [...s.queuedIds, id] })),
  remove: (id) => set((s) => ({ queuedIds: s.queuedIds.filter((x) => x !== id) })),
  clear: () => set({ queuedIds: [] }),
}));
