import { create } from "zustand";
import { persist } from "zustand/middleware";

export const DEFAULT_FARM_NAME = "My3DFarm";

type FarmState = {
  farmName: string;
  setFarmName: (name: string) => void;
};

export const useFarmStore = create<FarmState>()(
  persist(
    (set) => ({
      farmName: DEFAULT_FARM_NAME,
      setFarmName: (name) =>
        set({
          farmName: (name.trim() || DEFAULT_FARM_NAME).slice(0, 120),
        }),
    }),
    { name: "my3dfarm-farm" },
  ),
);
