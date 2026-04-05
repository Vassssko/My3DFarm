/** Strip trailing `-g<hex>` suffix from `git describe` style strings for compact UI. */
export function stripVersionGhash(version: string): string {
  const t = version.trim();
  if (!t) {
    return t;
  }
  return t.replace(/-g[0-9a-fA-F]+$/u, "");
}
