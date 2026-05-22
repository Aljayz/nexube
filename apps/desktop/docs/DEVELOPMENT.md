# Nexube — Developer Guide

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Setup](#2-setup)
3. [Development Commands](#3-development-commands)
4. [Project Structure](#4-project-structure)
5. [Adding a New IPC Channel](#5-adding-a-new-ipc-channel)
6. [Adding a New Page](#6-adding-a-new-page)
7. [Adding a New Settings Tab](#7-adding-a-new-settings-tab)
8. [Working with the Database](#8-working-with-the-database)
9. [Working with Packages](#9-working-with-packages)
10. [Building for Distribution](#10-building-for-distribution)
11. [Release Process](#11-release-process)
12. [Code Conventions](#12-code-conventions)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | >= 18 | |
| pnpm | >= 9 | Install via `npm i -g pnpm` |
| Python | >= 3.8 | Only needed if recompiling vid-dl |
| Rust | — | Only needed on macOS for vid-dl compilation |

### Platform-Specific Dependencies (for builds)

**Linux:**
```bash
# Debian/Ubuntu
sudo apt install wine64       # Only needed for Windows (NSIS) builds
```

**Windows:**
- Visual Studio Build Tools (for native modules)

**macOS:**
- Xcode Command Line Tools
- `brew install`

---

## 2. Setup

```bash
# Navigate to the monorepo root
cd app/nexube

# Install all dependencies
pnpm install

# Build dependent packages
pnpm --filter @nexube/types run build
pnpm --filter @nexube/store run build
pnpm --filter @nexube/player-engine run build
pnpm --filter @nexube/ui-tokens run build
```

> **Note:** The development workflow for `apps/desktop` handles building `@nexube/types` and `@nexube/store` automatically via the `dev` and `build` scripts.

---

## 3. Development Commands

Run these from `apps/desktop/` unless otherwise noted.

| Command | Description |
|---|---|
| `pnpm dev` | Web-only Vite dev server at `http://localhost:5173` |
| `pnpm build` | Production renderer build |
| `pnpm preview` | Preview production build |
| `pnpm electron:dev` | Full Electron + Vite hot reload |
| `pnpm electron:build` | Production build + electron-builder packaging |
| `pnpm copy-electron` | Copy `electron/ipc/` and `electron/services/` to `dist-electron/` |

### Turbo (from monorepo root)

```bash
pnpm dev       # Runs all workspace dev scripts
pnpm build     # Runs all workspace builds
pnpm typecheck # TypeScript checks across all packages
```

---

## 4. Project Structure

### 4.1 Monorepo Layout

```
app/nexube/
├── apps/
│   ├── desktop/          # <-- Main Electron application
│   └── avatar/           # Avatar processing service
├── packages/
│   ├── store/            # @nexube/store — SQLite database layer
│   ├── types/            # @nexube/types — Shared type definitions
│   ├── player-engine/    # @nexube/player-engine — Player logic
│   └── ui-tokens/        # @nexube/ui-tokens — Design tokens
├── api/                  # Vercel serverless functions
├── package.json          # Turborepo root
├── pnpm-workspace.yaml
└── turbo.json
```

### 4.2 Desktop App Structure

```
apps/desktop/
├── electron/
│   ├── main.js              # Entry point: window creation, IPC registration
│   ├── preload.js           # contextBridge: exposes window.electron.*
│   ├── popout-preload.js    # Minimal preload for PiP popout windows
│   ├── ipc/                 # IPC handlers (one per domain)
│   │   ├── allmanga.js      # AllManga source resolution
│   │   ├── blockStats.js    # Ad/popup blocking statistics
│   │   ├── downloads.js     # Download management
│   │   ├── library.js       # Favorites, saved, progress, history
│   │   ├── player.js        # PiP popout, video control
│   │   ├── profiles.js      # Profile CRUD, PIN/password verification
│   │   ├── storage.js       # electron-store (JSON) operations
│   │   ├── system.js        # System info, cache, reset
│   │   ├── tmdb.js          # TMDB API proxy
│   │   └── window.js        # Window minimize/maximize/close
│   └── services/
│       ├── downloader.js    # Bundle binary path resolution
│       ├── hls-capture.js   # HLS stream interception logic
│       └── sources.js       # Source URL construction
├── src/
│   ├── main.jsx             # React entry point
│   ├── App.jsx              # Root component
│   ├── pages/               # Route-level page components
│   │   ├── DetailView.jsx
│   │   ├── DownloadsPage.jsx
│   │   ├── HomeView.jsx
│   │   ├── LibraryView.jsx
│   │   ├── NotificationView.jsx
│   │   ├── SearchView.jsx
│   │   └── SettingsPage.jsx
│   ├── components/          # Reusable components
│   │   ├── settings/        # Settings sub-components (9)
│   │   ├── PlayerSection.jsx
│   │   ├── ProfileSelectScreen.jsx
│   │   ├── SecurityOverlay.jsx
│   │   └── ... (30 total)
│   ├── hooks/               # Custom React hooks
│   │   ├── useBlockedStats.js
│   │   ├── useDetailData.js
│   │   ├── useDownloads.js
│   │   ├── usePlayer.js
│   │   └── useSettings.js
│   └── styles/
│       └── globals.css      # Tailwind + custom theme
├── scripts/
│   └── copy-electron.cjs    # Copies IPC/services to dist-electron/
├── resources/
│   └── vid-dl/              # Bundled binaries per platform
├── public/                  # Static assets (icons, avatars)
├── package.json
├── vite.config.mjs
├── tailwind.config.js
└── postcss.config.js
```

---

## 5. Adding a New IPC Channel

### Step 1: Create or extend handler in `electron/ipc/`

```js
// electron/ipc/my-feature.js
const { ipcMain } = require('electron');

function register() {
  ipcMain.handle('my-feature:doSomething', async (_, arg) => {
    // Business logic here
    return { success: true, result: /* ... */ };
  });
}

module.exports = { register };
```

### Step 2: Register in `electron/main.js`

```js
const { register: registerMyFeature } = require('./ipc/my-feature');

// In app.whenReady().then(() => { ... })
registerMyFeature();
```

### Step 3: Expose in `electron/preload.js`

```js
contextBridge.exposeInMainWorld('electron', {
  // ... existing APIs ...
  myFeature: {
    doSomething: (arg) => ipcRenderer.invoke('my-feature:doSomething', arg),
  },
});
```

### Step 4: Call from React

```jsx
const result = await window.electron.myFeature.doSomething(arg);
```

---

## 6. Adding a New Page

1. Create the page component in `src/pages/`
2. Import and add route in `src/App.jsx` navigation handler
3. Add link in `src/components/Navbar.jsx`
4. Add translation/display name if needed

Example page registration in `App.jsx`:

```js
// In the navigateTo or page router logic
'my-page': MyPageComponent,
```

---

## 7. Adding a New Settings Tab

1. Create component in `src/components/settings/`
2. Import in `src/pages/SettingsPage.jsx`
3. Add tab entry in the tabs array
4. Filter by `isMaster` if admin-only

---

## 8. Working with the Database

### 8.1 Database Location

The SQLite database file is stored at:
```
apps/desktop/nexube.db
```

In production, this will be in the user's app data directory.

### 8.2 Accessing the Database

```js
const { getDatabase } = require('@nexube/store');
const db = getDatabase();
const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId);
```

### 8.3 Common Query Patterns

```js
// All profiles
const profiles = db.prepare('SELECT * FROM profiles ORDER BY last_used DESC').all();

// Per-profile settings
const settings = db.prepare('SELECT key, value FROM settings WHERE profile_id = ?').all(id);

// Watchlist for a profile
const watchlist = db.prepare(
  'SELECT * FROM watchlist WHERE profile_id = ? ORDER BY added_at DESC'
).all(profileId);
```

---

## 9. Working with Packages

### 9.1 @nexube/types

Shared TypeScript interfaces for media, player, profile, and TMDB data.

```bash
pnpm --filter @nexube/types run build
```

### 9.2 @nexube/store

SQLite database layer using `better-sqlite3`. Provides `getDatabase()` singleton and schema initialization.

```bash
pnpm --filter @nexube/store run build
```

### 9.3 @nexube/player-engine

Player logic including AniSkip integration, source detection, progress tracking, and state machine.

### 9.4 @nexube/ui-tokens

Design tokens for colors, spacing, and typography used across the app.

---

## 10. Building for Distribution

### 10.1 Linux

```bash
pnpm electron:build
# Outputs in release/:
#   Nexube-0.1.0-x86_64.AppImage
#   nexube_0.1.0_amd64.deb
#   nexube-0.1.0-1-x86_64.pkg.tar.zst
```

### 10.2 Windows (from Linux)

Requires Wine:

```bash
pnpm electron:build --win
# Outputs in release/:
#   Nexube-Setup-0.1.0-x64.exe
```

### 10.3 macOS

Requires macOS or GitHub Actions:

```bash
pnpm electron:build --mac
# Outputs in release/:
#   Nexube-0.1.0-arm64.dmg
#   Nexube-0.1.0-x64.dmg
```

### 10.4 Release Structure

```
release/
├── Nexube-0.1.0-x86_64.AppImage      # Linux portable
├── nexube_0.1.0_amd64.deb            # Debian/Ubuntu
├── nexube-0.1.0-1-x86_64.pkg.tar.zst # Arch Linux
├── Nexube-Setup-0.1.0-x64.exe        # Windows NSIS
├── Nexube-0.1.0-arm64.dmg            # macOS Apple Silicon
└── Nexube-0.1.0-x64.dmg              # macOS Intel
```

---

## 11. Release Process

1. Bump version in `apps/desktop/package.json`
2. Update `CHANGELOG.md` (if maintained)
3. Build for target platform(s):
   ```bash
   pnpm electron:build
   ```
4. Verify the build artifacts in `release/`
5. Create a GitHub Release with tag `v{version}`:
   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```
6. Upload build artifacts to the release
7. The auto-updater will detect the new version on next app launch

---

## 12. Code Conventions

### JavaScript/React

- **Functional components** only (no class components)
- **Custom hooks** prefixed with `use`
- **Named exports** preferred over default exports (except for page components)
- **No inline styles** — use Tailwind utility classes

### Naming

| Element | Convention | Example |
|---|---|---|
| Files (components) | PascalCase | `PlayerSection.jsx` |
| Files (utilities) | camelCase | `source-detector.ts` |
| Variables / Functions | camelCase | `getBlockStats` |
| Constants | UPPER_SNAKE_CASE | `BLOCKED_HOSTS` |
| IPC channels | kebab-case with namespace | `download:progress` |
| IPC handlers | snake_case file names | `blockStats.js` |

### Electron

- `(e.metaKey || e.ctrlKey)` for cross-platform keyboard shortcuts
- `process.platform` checks for OS-specific behavior
- All IPC handlers are registered via `register()` exports in `electron/ipc/`

### Database

- Parameterized queries only (no string concatenation)
- snake_case for table and column names

---

## 13. Troubleshooting

### "sandbox" errors on Linux

```bash
# The app uses --no-sandbox flag. If you see sandbox-related errors:
# Ensure user namespaces are enabled:
sudo sysctl kernel.unprivileged_userns_clone=1
```

### Missing vid-dl binary

If the bundled downloader is missing, the app will fall back to the user-configured downloader path. Verify the binary exists at:

```
resources/vid-dl/linux/vid-dl/vid-dl
resources/vid-dl/windows/vid-dl/vid-dl.exe
```

### "electron-builder install-app-deps" fails

```bash
# Ensure native modules are rebuilt for your Electron version
pnpm postinstall
```

### TMDB API Key issues

- Ensure the key is valid at https://www.themoviedb.org/settings/api
- Check that the key is stored correctly in the app's settings
- API keys are stored in `electron-store` (JSON), not in SQLite

### Windows build on Linux fails

```bash
# Ensure wine64 is installed
which wine64
# If not present:
sudo apt install wine64
```

### Vite dev server won't start

```bash
# Make sure dependent packages are built first
pnpm --filter @nexube/types run build
pnpm --filter @nexube/store run build
```
