import { afterEach, describe, expect, it } from "vitest";
import { migrateLegacyStorageKeys } from "./migrateLegacyStorageKeys";

describe("migrateLegacyStorageKeys", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("copies skladom-printers to my3dfarm-printers and removes old key", () => {
    localStorage.setItem("skladom-printers", '{"state":{"printers":[]},"version":0}');
    migrateLegacyStorageKeys();
    expect(localStorage.getItem("my3dfarm-printers")).toBe('{"state":{"printers":[]},"version":0}');
    expect(localStorage.getItem("skladom-printers")).toBeNull();
  });

  it("does not overwrite new key if already set", () => {
    localStorage.setItem("skladom-printers", '{"old":true}');
    localStorage.setItem("my3dfarm-printers", '{"new":true}');
    migrateLegacyStorageKeys();
    expect(localStorage.getItem("my3dfarm-printers")).toBe('{"new":true}');
    expect(localStorage.getItem("skladom-printers")).toBeNull();
  });
});
