import { describe, expect, it } from "vitest";
import { clearDebugEvents, getDebugEvents, pushDebugEvent } from "./debugRingBuffer";

describe("debugRingBuffer", () => {
  it("caps length", () => {
    clearDebugEvents();
    for (let i = 0; i < 85; i++) {
      pushDebugEvent({ kind: "t", message: String(i) });
    }
    expect(getDebugEvents().length).toBe(80);
    expect(getDebugEvents()[0]?.message).toBe("5");
  });

  it("clear empties buffer", () => {
    pushDebugEvent({ kind: "x", message: "a" });
    clearDebugEvents();
    expect(getDebugEvents()).toEqual([]);
  });
});
