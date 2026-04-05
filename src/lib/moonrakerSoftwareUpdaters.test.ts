import { describe, expect, it } from "vitest";
import { getMoonrakerSystemPackageCount, listSoftwareUpdaters } from "./moonrakerSoftwareUpdaters";

describe("moonrakerSoftwareUpdaters", () => {
  it("excludes system entry from software list", () => {
    const rows = listSoftwareUpdaters({
      system: { configured_type: "system", name: "system", package_count: 3 },
      klipper: {
        configured_type: "git_repo",
        name: "klipper",
        version: "v0.12-1-gabc",
        remote_version: "v0.12-2-gdef",
        is_valid: true,
        commits_behind: [{ sha: "x" }],
      },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.key).toBe("klipper");
    expect(rows[0]!.needsUpdate).toBe(true);
  });

  it("reads system package count", () => {
    expect(
      getMoonrakerSystemPackageCount({
        system: { configured_type: "system", package_count: 7 },
      }),
    ).toBe(7);
  });
});
