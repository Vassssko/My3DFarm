import { stripVersionGhash } from "./stripVersionGhash";

export type MoonrakerUpdaterRow = {
  key: string;
  name: string;
  configuredType: string;
  versionDisplay: string;
  remoteDisplay: string;
  isValid: boolean;
  needsUpdate: boolean;
  corrupt?: boolean;
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function updaterNeedsUpdate(o: Record<string, unknown>): boolean {
  const type = str(o.configured_type);
  const version = str(o.version);
  const remote = str(o.remote_version);
  const vSt = stripVersionGhash(version);
  const rSt = stripVersionGhash(remote);
  if (type === "git_repo") {
    const behind = o.commits_behind;
    if (Array.isArray(behind) && behind.length > 0) {
      return true;
    }
    const cnt = o.commits_behind_count;
    if (typeof cnt === "number" && cnt > 0) {
      return true;
    }
  }
  if (!version || !remote) {
    return false;
  }
  return vSt !== rSt;
}

/** Entries in version_info suitable for the “printer software” list (excludes `system`). */
export function listSoftwareUpdaters(versionInfo: unknown): MoonrakerUpdaterRow[] {
  if (!versionInfo || typeof versionInfo !== "object") {
    return [];
  }
  const vi = versionInfo as Record<string, unknown>;
  const out: MoonrakerUpdaterRow[] = [];
  for (const key of Object.keys(vi)) {
    if (key === "system") {
      continue;
    }
    const raw = vi[key];
    if (!raw || typeof raw !== "object") {
      continue;
    }
    const o = raw as Record<string, unknown>;
    const configuredType = str(o.configured_type);
    if (!configuredType) {
      continue;
    }
    const name = str(o.name) || key;
    const version = str(o.version);
    const remote = str(o.remote_version);
    const isValid = o.is_valid === true;
    const corrupt = o.corrupt === true;
    const needsUpdate = isValid && !corrupt && updaterNeedsUpdate(o);
    out.push({
      key,
      name,
      configuredType,
      versionDisplay: stripVersionGhash(version) || "—",
      remoteDisplay: stripVersionGhash(remote) || "—",
      isValid,
      needsUpdate,
      corrupt,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function getMoonrakerSystemPackageCount(versionInfo: unknown): number | null {
  if (!versionInfo || typeof versionInfo !== "object") {
    return null;
  }
  const sys = (versionInfo as Record<string, unknown>).system;
  if (!sys || typeof sys !== "object") {
    return null;
  }
  const n = (sys as Record<string, unknown>).package_count;
  return typeof n === "number" ? n : null;
}
