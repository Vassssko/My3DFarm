/** Moonraker GET /server/info (subset). */
export interface MoonrakerServerInfo {
  klippy_connected: boolean;
  klippy_state: string;
  moonraker_version: string;
  api_version_string?: string;
}

/** Moonraker GET /machine/proc_stats (subset). */
export interface MoonrakerProcStats {
  system_uptime?: number;
}

/** Moonraker GET /printer/info (subset). */
export interface MoonrakerPrinterInfo {
  state: string;
  state_message?: string;
  hostname: string;
  software_version: string;
}

/** Moonraker GET /printer/objects/list */
export interface MoonrakerObjectsList {
  objects: string[];
}

/** Moonraker POST /printer/objects/query payload (after `result` unwrap may include e.g. `eventtime`). */
export interface MoonrakerObjectsQueryResult {
  status: Record<string, Record<string, unknown>>;
}

export type DiscoveredHostPayload = {
  baseUrl: string;
  label: string;
  sources: string[];
};
