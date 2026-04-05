import { describe, expect, it } from "vitest";
import { dedupeUpstreamRepoRefs, upstreamRepoKey } from "./githubUpstreamTags";

describe("dedupeUpstreamRepoRefs", () => {
  it("keeps one entry per owner/repo", () => {
    const out = dedupeUpstreamRepoRefs([
      { owner: "Klipper3d", repo: "klipper" },
      { owner: "Klipper3d", repo: "klipper" },
      { owner: "Arksine", repo: "moonraker" },
    ]);
    expect(out).toHaveLength(2);
    expect(new Set(out.map(upstreamRepoKey))).toEqual(
      new Set(["Klipper3d/klipper", "Arksine/moonraker"]),
    );
  });
});
