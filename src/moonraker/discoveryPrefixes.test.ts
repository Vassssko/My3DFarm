import { describe, expect, it } from "vitest";
import { farmPrioritySubnetPrefixes } from "./discoveryPrefixes";

describe("farmPrioritySubnetPrefixes", () => {
  it("dedupes /24 from IPv4 hosts in order", () => {
    expect(
      farmPrioritySubnetPrefixes([
        "http://192.168.1.120:7125",
        "http://192.168.1.50:7125",
        "http://10.0.0.1:7125",
      ]),
    ).toEqual(["192.168.1", "10.0.0"]);
  });

  it("skips non-IPv4 hostnames", () => {
    expect(farmPrioritySubnetPrefixes(["http://voron.local:7125"])).toEqual([]);
  });
});
