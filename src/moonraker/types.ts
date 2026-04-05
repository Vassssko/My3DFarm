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

/** Moonraker GET /machine/system_info — shape varies by version; keep loose. */
export type MoonrakerMachineSystemInfo = {
  system_info?: Record<string, unknown>;
  [key: string]: unknown;
};

/** Moonraker GET /machine/update/status — shape varies; often version_info map. */
export type MoonrakerMachineUpdateStatus = {
  version_info?: Record<string, unknown>;
  busy?: boolean;
  [key: string]: unknown;
};

export type MoonrakerFileListEntry = {
  path?: string;
  dirname?: string;
  filename?: string;
  modified?: number;
  size?: number;
  [key: string]: unknown;
};

/** Moonraker GET /server/history/list — job row (subset; Moonraker adds more fields). */
export type MoonrakerHistoryJob = {
  job_id?: string;
  filename?: string;
  status?: string;
  start_time?: number;
  /** Unix seconds when the job finished; missing/null while in progress */
  end_time?: number | null;
  [key: string]: unknown;
};

export type MoonrakerHistoryListResponse = {
  count: number;
  jobs: MoonrakerHistoryJob[];
};
