import { describe, expect, it } from "vitest";
import { runWithConcurrency } from "./runWithConcurrency";

describe("runWithConcurrency", () => {
  it("maps all items and preserves order", async () => {
    const out = await runWithConcurrency([1, 2, 3, 4], 2, async (n) => n * 10);
    expect(out).toEqual([10, 20, 30, 40]);
  });
});
