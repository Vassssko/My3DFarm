# My3DFarm

Desktop app to manage multiple **Klipper** printers through the **Moonraker** HTTP API. Built with **Tauri 2**, **React 19**, **TypeScript**, **Vite**, **Tailwind CSS**, **Zustand**, and **react-i18next** (`en`, `ru`, `de`, `zh`).

## Requirements

- **Node.js** (LTS recommended)
- **Rust** (stable toolchain)
- **Windows:** WebView2 + MSVC (Visual Studio Build Tools with C++)
- **macOS / Linux:** follow [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

Primary UX target is **Windows**; release builds also aim at **macOS (Apple Silicon)** and **Linux** (Debian 12+ with GNOME).

## Development

```bash
npm install
npm run tauri dev
```

Frontend only (no Tauri shell):

```bash
npm run dev
```

## Production build / installers

```bash
npm run tauri build
```

Artifacts: `src-tauri/target/release/bundle/` (e.g. `.msi` / `.exe` on Windows, `.dmg` / `.app` on macOS, `.deb` / `.AppImage` on Linux depending on configured targets).

## Tests

```bash
npm run test          # Vitest (unit)
npm run test:e2e      # Playwright
npm run test:all      # both
```

Moonraker is not required for automated tests; E2E uses routed mocks (see `e2e/` and `src/test/`).

## Versions and commits

- Commit style and how **semver** / **git tags** (`v0.x.y`) are produced: [CONTRIBUTING.md](CONTRIBUTING.md).
- On each push to `main`, [Release Please](https://github.com/googleapis/release-please) updates or opens a **Release PR**; after you merge it, GitHub gets a matching tag and release. Changelog: [CHANGELOG.md](CHANGELOG.md).

## References

- [Moonraker external API](https://moonraker.readthedocs.io/en/latest/external_api/) — HTTP endpoints, JSON shapes, authentication
- [Klipper configuration reference](https://www.klipper3d.org/Config_Reference.html) — `printer.cfg` sections and parameters
- [Esoterical’s CANBus Guide](https://canbus.esoterical.online/) — CAN setup, flashing, updates, troubleshooting on Klipper printers

## IDE

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
