import { describe, expect, it } from "vitest";
import { sanitizeNetworkPrefixesInput } from "./sanitizeNetworkPrefixInput";

describe("sanitizeNetworkPrefixesInput", () => {
  it("replaces commas with dots", () => {
    expect(sanitizeNetworkPrefixesInput("192,168,1")).toBe("192.168.1");
  });

  it("strips letters", () => {
    expect(sanitizeNetworkPrefixesInput("192.168.1abc")).toBe("192.168.1");
    expect(sanitizeNetworkPrefixesInput("a192.168.1")).toBe("192.168.1");
  });

  it("keeps newlines semicolons and spaces for multiple prefixes", () => {
    expect(sanitizeNetworkPrefixesInput("192.168.1\n10.0.0")).toBe("192.168.1\n10.0.0");
    expect(sanitizeNetworkPrefixesInput("192.168.1; 10.0.0")).toBe("192.168.1; 10.0.0");
  });
});
