import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SshSettingsState = {
  defaultSshUser: string;
  defaultSshPort: number;
  applyHostHintToUsername: boolean;
  setDefaultSshUser: (v: string) => void;
  setDefaultSshPort: (v: number) => void;
  setApplyHostHintToUsername: (v: boolean) => void;
};

export const useSshSettingsStore = create<SshSettingsState>()(
  persist(
    (set) => ({
      defaultSshUser: "pi",
      defaultSshPort: 22,
      applyHostHintToUsername: true,
      setDefaultSshUser: (v) => set({ defaultSshUser: v }),
      setDefaultSshPort: (v) => set({ defaultSshPort: Number.isFinite(v) && v > 0 ? v : 22 }),
      setApplyHostHintToUsername: (v) => set({ applyHostHintToUsername: v }),
    }),
    { name: "my3dfarm-ssh-settings" },
  ),
);
