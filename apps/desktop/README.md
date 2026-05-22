# Nexube

A desktop media streaming application built with Electron, React, and Vite.

## Features

- **Multi-Profile System** — Master, Kids, and Standard profiles with PIN/password protection
- **Multi-Source Player** — Videasy, VidSrc, 2Embed, and AllManga (anime) with instant source switching
- **Pop-up & Redirect Blocking** — Webview-level interception with per-session stats tracker
- **Picture-in-Picture** — Native PiP popout with cross-platform window frame configuration
- **Per-Profile Settings** — Accent color, download path, preferred source, auto-mark-watched threshold, search history
- **Download Manager** — HLS stream capture via bundled `vid-dl` binary (PyInstaller)
- **Content Filtering** — Age-based filtering with Kids Mode
- **Watchlist, History & Progress** — SQLite-persistent per profile
- **Feedback System** — In-app report submission via serverless proxy → GitHub Issues
- **Cross-Platform** — Windows (NSIS), macOS (DMG), Linux (AppImage, deb, pacman)

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop Framework | Electron 28 |
| UI | React 18 + Tailwind CSS 3 |
| Build | Vite 5 + `vite-plugin-electron` |
| State/Database | SQLite via `@nexube/store` |
| Streaming | System webview (iframe embeds) |
| Packaging | electron-builder 24 |
| Monorepo | pnpm workspaces + Turborepo |

## Quick Start

```bash
# Prerequisites: Node >=18, pnpm >=9, Python (for vid-dl)

# Clone and install
git clone https://github.com/Aljayz/nexube.git
cd nexube/apps/desktop
pnpm install

# Run in dev mode (web only, hot reload)
pnpm dev

# Run in Electron dev mode
pnpm electron:dev
```

## Available Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Web-only Vite dev server (port 5173) |
| `pnpm build` | Production renderer build |
| `pnpm electron:dev` | Electron + Vite hot reload |
| `pnpm electron:build` | Full production build + packaging |

## Project Structure

```
apps/desktop/
├── electron/              # Electron main process
│   ├── main.js            # App entry, window creation, IPC registration
│   ├── preload.js         # Context bridge (exposed as window.electron.*)
│   ├── popout-preload.js  # Minimal preload for PiP windows
│   ├── ipc/               # IPC handlers (10 modules)
│   └── services/          # Backend services (downloader, HLS capture, sources)
├── src/                   # React renderer
│   ├── pages/             # Route-level components (7 pages)
│   ├── components/        # Reusable UI (30 components)
│   ├── hooks/             # Custom hooks (5)
│   └── App.jsx            # Root component
├── scripts/               # Build scripts
├── resources/             # Bundled binaries (vid-dl per platform)
├── public/                # Static assets (icons, avatars)
├── package.json
├── vite.config.mjs
└── tailwind.config.js

packages/
├── store/                 # @nexube/store — SQLite database layer
├── types/                 # @nexube/types — Shared TypeScript types
├── player-engine/         # @nexube/player-engine — Player logic
└── ui-tokens/             # @nexube/ui-tokens — Design tokens (colors, spacing)
```

## Documentation

- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) — System architecture, data flow, IPC map
- [DEVELOPMENT.md](./docs/DEVELOPMENT.md) — Developer guide, setup, conventions
- [FEEDBACK_SYSTEM_SETUP.md](./FEEDBACK_SYSTEM_SETUP.md) — Deploying the feedback proxy

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd + K` / `Ctrl/Cmd + F` | Open search |
| `Ctrl/Cmd + Z` | Navigate back |
| `Ctrl/Cmd + R` | Reload app |
| `Ctrl/Cmd + X` | Logout |
| `Escape` | Close modal / player |
| `?` | Show help & shortcuts |
| `Space` | Play/Pause (player) |
| `F` | Fullscreen (player) |
| `Left/Right` | Seek ±10s (player) |

## Building for Distribution

```bash
# Linux (AppImage + deb + pacman)
pnpm electron:build

# Windows (NSIS) — requires Wine on Linux
pnpm electron:build --win

# macOS (DMG) — requires macOS
pnpm electron:build --mac
```

Outputs platform-specific installers in `release/`.

## License

MIT — see [LICENSE](./LICENSE)

Copyright (c) 2025 Aljayz
