import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearLocaleOverride,
  detectOsLanguage,
  getLocaleOverride,
  LOCALE_STORAGE_KEY,
  setLocaleOverride,
} from "./locale";

describe("locale", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(navigator, "languages", {
      configurable: true,
      value: ["en-US"],
    });
    Object.defineProperty(navigator, "language", {
      configurable: true,
      value: "en-US",
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("detectOsLanguage returns en from navigator", () => {
    expect(detectOsLanguage()).toBe("en");
  });

  it("detectOsLanguage returns ru when unsupported", () => {
    Object.defineProperty(navigator, "languages", {
      configurable: true,
      value: ["xx-YY"],
    });
    Object.defineProperty(navigator, "language", {
      configurable: true,
      value: "xx-YY",
    });
    expect(detectOsLanguage()).toBe("ru");
  });

  it("get/set/clear locale override", () => {
    expect(getLocaleOverride()).toBeNull();
    setLocaleOverride("de");
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("de");
    expect(getLocaleOverride()).toBe("de");
    clearLocaleOverride();
    expect(getLocaleOverride()).toBeNull();
  });
});
