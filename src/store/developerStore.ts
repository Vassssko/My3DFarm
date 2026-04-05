import { create } from "zustand";
import { persist } from "zustand/middleware";

type DeveloperState = {
  developerMode: boolean;
  setDeveloperMode: (v: boolean) => void;
};

export const useDeveloperStore = create<DeveloperState>()(
  persist(
    (set) => ({
      developerMode: false,
      setDeveloperMode: (developerMode) => set({ developerMode }),
    }),
    { name: "my3dfarm-dev" },
  ),
);
