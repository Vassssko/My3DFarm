import { create } from "zustand";

export type NetworkSample = {
  at: number;
  /** Raw `ip -s link` (or subset) for diff heuristics. */
  raw: string;
};

type HealthState = {
  /** Last N samples per printer (session + optional small persist later). */
  byPrinterId: Record<string, NetworkSample[]>;
  recordNetworkSample: (printerId: string, raw: string, maxSamples?: number) => void;
  clearPrinter: (printerId: string) => void;
};

const DEFAULT_MAX = 12;

/** Stable fallback for selectors — never use `?? []` inline (new array every call → Zustand re-subscribe loop). */
export const EMPTY_NETWORK_SAMPLES: NetworkSample[] = [];

export const useHealthSamplesStore = create<HealthState>()((set) => ({
  byPrinterId: {},
  recordNetworkSample: (printerId, raw, maxSamples = DEFAULT_MAX) =>
    set((s) => {
      const prev = s.byPrinterId[printerId] ?? [];
      const nextSample: NetworkSample = { at: Date.now(), raw };
      const merged = [...prev, nextSample].slice(-maxSamples);
      return {
        byPrinterId: { ...s.byPrinterId, [printerId]: merged },
      };
    }),
  clearPrinter: (printerId) =>
    set((s) => {
      const { [printerId]: _, ...rest } = s.byPrinterId;
      return { byPrinterId: rest };
    }),
}));
