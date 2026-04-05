import { describe, expect, it } from "vitest";
import { parseHostSoftwareSnapshot } from "./parseHostSoftwareSnapshot";

describe("parseHostSoftwareSnapshot", () => {
  it("parses MY3DFARM lines", () => {
    const o = parseHostSoftwareSnapshot(
      "MY3DFARM_APT_COUNT=4\nMY3DFARM_KERNEL=6.1.0\nMY3DFARM_ARCH=aarch64\n",
    );
    expect(o.aptUpgradeCount).toBe(4);
    expect(o.kernel).toBe("6.1.0");
    expect(o.machineArch).toBe("aarch64");
  });
});
