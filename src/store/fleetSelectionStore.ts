import { create } from "zustand";

type FleetSelectionState = {
  selectMode: boolean;
  selectedIds: string[];
  setSelectMode: (on: boolean) => void;
  toggle: (id: string) => void;
  clearSelection: () => void;
  selectAllPrinterIds: (ids: string[]) => void;
};

export const useFleetSelectionStore = create<FleetSelectionState>((set) => ({
  selectMode: false,
  selectedIds: [],
  setSelectMode: (on) => set({ selectMode: on, selectedIds: [] }),
  toggle: (id) =>
    set((s) => ({
      selectedIds: s.selectedIds.includes(id)
        ? s.selectedIds.filter((x) => x !== id)
        : [...s.selectedIds, id],
    })),
  clearSelection: () => set({ selectedIds: [] }),
  selectAllPrinterIds: (ids) => set({ selectedIds: [...ids] }),
}));
