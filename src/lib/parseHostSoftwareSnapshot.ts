/** Parses MY3DFARM_* lines from `host_software_snapshot` SSH preset stdout. */
export type HostSoftwareSnapshot = {
  aptUpgradeCount: number;
  kernel: string | null;
  machineArch: string | null;
};

export function parseHostSoftwareSnapshot(stdout: string): HostSoftwareSnapshot {
  let aptUpgradeCount = 0;
  let kernel: string | null = null;
  let machineArch: string | null = null;
  for (const line of stdout.split(/\r?\n/u)) {
    const t = line.trim();
    if (t.startsWith("MY3DFARM_APT_COUNT=")) {
      const n = Number.parseInt(t.slice("MY3DFARM_APT_COUNT=".length), 10);
      aptUpgradeCount = Number.isFinite(n) ? Math.max(0, n) : 0;
    } else if (t.startsWith("MY3DFARM_KERNEL=")) {
      const v = t.slice("MY3DFARM_KERNEL=".length).trim();
      kernel = v || null;
    } else if (t.startsWith("MY3DFARM_ARCH=")) {
      const v = t.slice("MY3DFARM_ARCH=".length).trim();
      machineArch = v || null;
    }
  }
  return { aptUpgradeCount, kernel, machineArch };
}
