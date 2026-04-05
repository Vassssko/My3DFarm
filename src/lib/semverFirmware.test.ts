import { describe, expect, it } from "vitest";
import {
  compareSemverTriple,
  isDeviceVersionBehindTag,
  parseSemverPrefix,
  parseSemverTagName,
  pickHighestSemverTag,
} from "./semverFirmware";

describe("parseSemverPrefix", () => {
  it("reads X.Y.Z from git describe", () => {
    expect(parseSemverPrefix("v0.13.0-595-gb0e6ca45")).toEqual({
      major: 0,
      minor: 13,
      patch: 0,
    });
  });
  it("handles moonraker-style mock strings", () => {
    expect(parseSemverPrefix("v0.9.3-12-gmock")).toEqual({ major: 0, minor: 9, patch: 3 });
  });
  it("returns null for empty or em dash", () => {
    expect(parseSemverPrefix("")).toBeNull();
    expect(parseSemverPrefix("—")).toBeNull();
  });
});

describe("parseSemverTagName", () => {
  it("accepts clean tags", () => {
    expect(parseSemverTagName("v0.10.0")).toEqual({ major: 0, minor: 10, patch: 0 });
  });
  it("rejects junk tags", () => {
    expect(parseSemverTagName("v.08")).toBeNull();
  });
});

describe("pickHighestSemverTag", () => {
  it("picks max semver", () => {
    expect(pickHighestSemverTag(["v0.9.3", "v0.10.0", "v.08", "nope"])).toBe("v0.10.0");
  });
});

describe("isDeviceVersionBehindTag", () => {
  it("is true when device base is older than upstream tag", () => {
    expect(isDeviceVersionBehindTag("v0.9.3-1-gx", "v0.10.0")).toBe(true);
  });
  it("is false when same or newer base", () => {
    expect(isDeviceVersionBehindTag("v0.10.0-5-gx", "v0.10.0")).toBe(false);
    expect(isDeviceVersionBehindTag("v0.11.0", "v0.10.0")).toBe(false);
  });
});

describe("compareSemverTriple", () => {
  it("orders correctly", () => {
    expect(
      compareSemverTriple(
        { major: 0, minor: 9, patch: 3 },
        { major: 0, minor: 10, patch: 0 },
      ),
    ).toBeLessThan(0);
  });
});
