import { create } from "zustand";
import { persist } from "zustand/middleware";

export type BaselineState = {
  profileName: string;
  /** Flat resolved Klipper config text (same shape as extracted from klippy.log). */
  configText: string;
  setProfileName: (v: string) => void;
  setConfigText: (v: string) => void;
};

export const useBaselineStore = create<BaselineState>()(
  persist(
    (set) => ({
      profileName: "",
      configText: "",
      setProfileName: (v) => set({ profileName: v }),
      setConfigText: (v) => set({ configText: v }),
    }),
    {
      name: "my3dfarm-baseline",
      partialize: (s) => ({ profileName: s.profileName, configText: s.configText }),
    },
  ),
);
