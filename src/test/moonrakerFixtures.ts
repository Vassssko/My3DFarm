/**
 * Mock Moonraker JSON aligned with our `types` and Moonraker HTTP API.
 * Real Moonraker wraps these in `{ "result": ... }`; `unwrapMoonrakerJson` accepts both shapes.
 * Use documentation IP 192.0.2.0/24 (TEST-NET-1) so traffic is not confused with LAN.
 * @see https://moonraker.readthedocs.io/en/latest/external_api/
 */
export const MOCK_MOONRAKER_ORIGIN = "http://192.0.2.1:7125";

export const mockServerInfoReady = {
  klippy_connected: true,
  klippy_state: "ready",
  moonraker_version: "v0.9.3-12-gmock",
  api_version_string: "1.0.0",
};

export const mockServerInfoPrinting = {
  ...mockServerInfoReady,
  klippy_state: "ready",
};

export const mockProcStats = {
  system_uptime: 86400 + 3600 + 120,
};

export const mockPrinterInfo = {
  state: "ready",
  state_message: "Printer is ready",
  hostname: "mock-printer-e2e",
  software_version: "v0.12.0-123-gmock",
};

export const mockObjectsList = {
  objects: ["webhooks", "print_stats", "mcu", "mcu toolhead"],
};

export const mockObjectsQueryReady = {
  status: {
    webhooks: { state: "ready" },
    print_stats: { state: "standby", filename: "" },
    mcu: { mcu_version: "v0.12.0 mcu" },
    "mcu toolhead": { mcu_version: "v0.11.0 toolhead" },
  },
};

export const mockObjectsQueryPrinting = {
  status: {
    webhooks: { state: "ready" },
    print_stats: { state: "printing", filename: "benchy.gcode" },
    mcu: { mcu_version: "v0.12.0 mcu" },
  },
};

export const mockObjectsQueryError = {
  status: {
    webhooks: { state: "shutdown" },
    print_stats: { state: "standby" },
  },
};
