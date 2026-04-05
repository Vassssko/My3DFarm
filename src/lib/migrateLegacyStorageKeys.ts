/** Copy data from pre–My3DFarm localStorage keys, then remove legacy keys. */
export function migrateLegacyStorageKeys(): void {
  const pairs: Array<[string, string]> = [
    ["skladom-printers", "my3dfarm-printers"],
    ["skladom-farm", "my3dfarm-farm"],
    ["skladom-locale", "my3dfarm-locale"],
    ["skladom-theme", "my3dfarm-theme"],
  ];
  for (const [oldKey, newKey] of pairs) {
    try {
      const oldVal = localStorage.getItem(oldKey);
      if (oldVal === null) {
        continue;
      }
      if (localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, oldVal);
      }
      localStorage.removeItem(oldKey);
    } catch {
      /* private mode / quota */
    }
  }
}
