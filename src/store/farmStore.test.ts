import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_FARM_NAME, useFarmStore } from "./farmStore";

describe("farmStore", () => {
  beforeEach(() => {
    localStorage.removeItem("my3dfarm-farm");
    useFarmStore.setState({ farmName: DEFAULT_FARM_NAME });
  });

  it("defaults to My3DFarm", () => {
    expect(useFarmStore.getState().farmName).toBe("My3DFarm");
  });

  it("setFarmName trims and caps length", () => {
    useFarmStore.getState().setFarmName("  Lab A  ");
    expect(useFarmStore.getState().farmName).toBe("Lab A");
  });

  it("setFarmName falls back when empty", () => {
    useFarmStore.getState().setFarmName("x");
    useFarmStore.getState().setFarmName("   ");
    expect(useFarmStore.getState().farmName).toBe(DEFAULT_FARM_NAME);
  });
});
