/**
 * Klipper/Moonraker versions often look like `v0.13.0-595-gb0e6ca45` or
 * `...-gb0e6ca45f-dirty`. UI shows semver + commit count only.
 */
export function stripVersionForDisplay(version: string): string {
  let v = version.trim();
  let prev = "";
  while (v !== prev) {
    prev = v;
    v = v.replace(/-g[0-9a-f]+$/i, "");
    v = v.replace(/-dirty$/i, "");
  }
  return v;
}

/** True if the raw version string is a dirty git tree build (`-dirty` suffix). */
export function isDirtyVersion(version: string): boolean {
  return /-dirty$/i.test(version.trim());
}
