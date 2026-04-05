import { beforeEach, describe, expect, it } from "vitest";
import { useDeveloperStore } from "./developerStore";

describe("developerStore", () => {
  beforeEach(() => {
    localStorage.removeItem("my3dfarm-dev");
    useDeveloperStore.setState({ developerMode: false });
  });

  it("defaults developerMode false", () => {
    expect(useDeveloperStore.getState().developerMode).toBe(false);
  });

  it("setDeveloperMode toggles", () => {
    useDeveloperStore.getState().setDeveloperMode(true);
    expect(useDeveloperStore.getState().developerMode).toBe(true);
  });
});
