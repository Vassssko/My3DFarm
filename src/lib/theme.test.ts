import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyThemeClass, getStoredThemeMode, setStoredThemeMode, type ThemeMode } from "./theme";

const KEY = "my3dfarm-theme";

describe("theme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("getStoredThemeMode defaults to system", () => {
    expect(getStoredThemeMode()).toBe("system");
  });

  it.each<[ThemeMode, string | null]>([
    ["light", "light"],
    ["dark", "dark"],
    ["system", null],
  ])("setStoredThemeMode %s", (mode, stored) => {
    setStoredThemeMode(mode);
    expect(localStorage.getItem(KEY)).toBe(stored);
    expect(getStoredThemeMode()).toBe(mode);
  });

  it("applyThemeClass toggles dark for explicit dark", () => {
    setStoredThemeMode("dark");
    applyThemeClass();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("applyThemeClass removes dark for explicit light", () => {
    document.documentElement.classList.add("dark");
    setStoredThemeMode("light");
    applyThemeClass();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
