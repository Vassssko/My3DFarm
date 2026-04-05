import { describe, expect, it, vi } from "vitest";
import { enqueueFleetSnapshot } from "./fleetSnapshotQueue";

describe("enqueueFleetSnapshot", () => {
  it("runs tasks strictly one after another", async () => {
    const order: string[] = [];
    const slow = (name: string, ms: number) => async () => {
      order.push(`${name}-start`);
      await new Promise((r) => setTimeout(r, ms));
      order.push(`${name}-end`);
      return name;
    };

    const p1 = enqueueFleetSnapshot(slow("a", 40));
    const p2 = enqueueFleetSnapshot(slow("b", 15));
    const p3 = enqueueFleetSnapshot(slow("c", 15));

    await Promise.all([p1, p2, p3]);

    expect(order).toEqual(["a-start", "a-end", "b-start", "b-end", "c-start", "c-end"]);
    await expect(p1).resolves.toBe("a");
    await expect(p2).resolves.toBe("b");
    await expect(p3).resolves.toBe("c");
  });

  it("propagates rejection without breaking the chain", async () => {
    const spy = vi.fn();
    await expect(
      enqueueFleetSnapshot(async () => {
        throw new Error("x");
      }),
    ).rejects.toThrow("x");

    await enqueueFleetSnapshot(async () => {
      spy();
    });
    expect(spy).toHaveBeenCalled();
  });
});
