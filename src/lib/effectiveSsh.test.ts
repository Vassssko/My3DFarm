import { describe, expect, it } from "vitest";
import {
  hostFromMoonrakerBaseUrl,
  resolveEffectiveSsh,
  resolveEffectiveSshGlobalsOnly,
} from "./effectiveSsh";
import type { SavedPrinter } from "../store/printerStore";

describe("effectiveSsh", () => {
  it("parses host from Moonraker URL", () => {
    expect(hostFromMoonrakerBaseUrl("http://192.168.1.50:7125")).toBe("192.168.1.50");
  });

  it("applies printer overrides over globals", () => {
    const p = {
      id: "1",
      baseUrl: "http://10.0.0.2:7125",
      sshUser: "root",
      sshPort: 2222,
    } as SavedPrinter;
    const e = resolveEffectiveSsh(
      p,
      { defaultSshUser: "pi", defaultSshPort: 22, applyHostHintToUsername: true },
      { id: "x", suggestedUsername: "biqu" },
    );
    expect(e.host).toBe("10.0.0.2");
    expect(e.user).toBe("root");
    expect(e.port).toBe(2222);
  });

  it("uses hint username when no override", () => {
    const p = { id: "1", baseUrl: "http://192.168.1.1:7125" } as SavedPrinter;
    const e = resolveEffectiveSsh(
      p,
      { defaultSshUser: "pi", defaultSshPort: 22, applyHostHintToUsername: true },
      { id: "orange-pi", suggestedUsername: "orangepi" },
    );
    expect(e.user).toBe("orangepi");
    expect(e.matchedHintId).toBe("orange-pi");
  });

  it("globals-only ignores per-printer SSH overrides", () => {
    const p = {
      id: "1",
      baseUrl: "http://10.0.0.2:7125",
      sshUser: "root",
      sshPort: 2222,
      sshHost: "other.local",
    } as SavedPrinter;
    const g = resolveEffectiveSshGlobalsOnly(
      p,
      { defaultSshUser: "pi", defaultSshPort: 22, applyHostHintToUsername: false },
      null,
    );
    expect(g.host).toBe("10.0.0.2");
    expect(g.user).toBe("pi");
    expect(g.port).toBe(22);
  });
});
