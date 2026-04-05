import { describe, expect, it } from "vitest";
import { summarizeFleetInventory } from "./fleetInventorySummary";

describe("summarizeFleetInventory", () => {
  it("counts system packages and pending managed software", () => {
    const updateStatus = {
      version_info: {
        system: { package_count: 12 },
        klipper: {
          configured_type: "git_repo",
          is_valid: true,
          version: "v0.12.0-100-gabc",
          remote_version: "v0.12.0-100-gabc",
          commits_behind: [{}],
        },
        moonraker: {
          configured_type: "git_repo",
          is_valid: true,
          version: "v0.9.1",
          remote_version: "v0.9.2",
        },
      },
    };
    const systemInfo = {
      system_info: {
        distribution: { name: "Debian", version: "12", codename: "bookworm" },
      },
    };

    const r = summarizeFleetInventory(updateStatus, systemInfo);
    expect(r.hostPackagesPending).toBe(12);
    expect(r.managedSoftwareUpdates).toBe(2);
    expect(r.pendingModuleKeys.sort()).toEqual(["klipper", "moonraker"].sort());
    expect(r.osLine).toContain("Debian");
  });

  it("returns zeros when version_info missing", () => {
    const r = summarizeFleetInventory(null, null);
    expect(r.hostPackagesPending).toBeNull();
    expect(r.managedSoftwareUpdates).toBe(0);
    expect(r.pendingModuleKeys).toEqual([]);
    expect(r.osLine).toBeNull();
  });
});
