# Nexube — Architecture Document

> **Version:** 0.1.0 | **Last Updated:** May 2026

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Process Architecture](#2-process-architecture)
3. [IPC Channel Map](#3-ipc-channel-map)
4. [Data Flow](#4-data-flow)
5. [Database Schema](#5-database-schema)
6. [Player System](#6-player-system)
7. [Profile System](#7-profile-system)
8. [Settings System](#8-settings-system)
9. [Download System](#9-download-system)
10. [Feedback System](#10-feedback-system)
11. [Cross-Platform Considerations](#11-cross-platform-considerations)
12. [Security](#12-security)

---

## 1. System Overview

Nexube is a pnpm Turborepo monorepo with four packages and one desktop application. The architecture follows a **workspace-dependency pattern** where business logic (types, store, player engine, UI tokens) lives in shared packages consumed by the Electron desktop app.


### 1.1 High-Level Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                         Nexube Monorepo                                │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                   Electron Desktop App                           │  │
│  │  ┌──────────────────────────────────────┐  ┌──────────────────┐  │  │
│  │  │         Renderer Process             │  │   Main Process   │  │  │
│  │  │  ┌───────┐  ┌────────┐  ┌────────┐   │  │  ┌────────────┐  │  │  │
│  │  │  │ App   │  │ Pages  │  │  Hooks │   │  │  │  IPC       │  │  │  │
│  │  │  │ Shell │  │ (7)    │  │  (5)   │   │  │  │  Handlers  │  │  │  │
│  │  │  └──┬────┘  └────────┘  └────────┘   │  │  │  (10 mods) │  │  │  │
│  │  │     │        contextBridge           │  │  └──────┬─────┘  │  │  │
│  │  │     └──────────────┬───────────────────┼──────────┘        │  │  │
│  │  └────────────────────┼───────────────────┘                   │  │  │
│  │                       │ IPC (invoke/handle + send/on)         │  │  │
│  │  ┌────────────────────┼───────────────────────────────────┐   │  │  │
│  │  │  ┌─────────────────▼─────────────────────────────┐     │   │  │  │
│  │  │  │              Services                         │     │   │  │  │
│  │  │  │  downloader.js │ hls-capture.js │ sources.js  │     │   │  │  │
│  │  │  └───────────────────────┬───────────────────────┘     │   │  │  │
│  │  │                          │                             │   │  │  │
│  │  │  ┌───────────────────────▼─────────────────────────┐   │   │  │  │
│  │  │  │          @nexube/store (SQLite via better-sqlite3)  │   │  │  │
│  │  │  └─────────────────────────────────────────────────────┘   │  │  │
│  │  └────────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌─────────────┐ ┌──────────────┐ ┌────────────────┐ ┌─────────────┐   │
│  │ @nexube     │ │ @nexube      │ │ @nexube        │ │ @nexube     │   │
│  │ /types      │ │ /store       │ │ /player-engine │ │ /ui-tokens  │   │
│  └─────────────┘ └──────────────┘ └────────────────┘ └─────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

### 1.2 External Services

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│  TMDB    │   │ AniList  │   │ Videasy  │   │  AniSkip │   │ Feedback │
│  API v3  │   │ GraphQL  │   │ Player   │   │  API     │   │  Proxy   │
│          │   │          │   │          │   │          │   │(Vercel)  │
│Metadata /│   │  Anime   │   │  Stream  │   │  Op/Ed   │   │ GitHub   │
│ Search   │   │Metadata  │   │  URLs    │   │  Times   │   │ Issues   │
└────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘
     │              │              │              │              │
     ▼              ▼              ▼              ▼              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Main Process (IPC Handlers)                       │
│  tmdb.js │ allmanga.js │ player.js │ source resolution │ feedback    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Process Architecture

### 2.1 Electron Process Model

```
┌─────────────────────────────────────────────────────────────────┐
│                        Main Process                             │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐   │
│  │ Window   │  │  SQLite  │  │   IPC    │  │   vid-dl       │   │
│  │Manager   │  │  (better │  │ Handlers │  │   Subprocess   │   │
│  │          │  │ -sqlite3)│  │ (10)     │  │   (spawn)      │   │
│  └──────────┘  └──────────┘  └──────────┘  └────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                      Sessions                            │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐   │   │
│  │  │ default     │  │ persist:     │  │ persist:       │   │   │
│  │  │ (main app)  │  │ player       │  │ trailer        │   │   │
│  │  └─────────────┘  └──────────────┘  └────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
         │ IPC (contextBridge)
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Renderer Process                           │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  React App   │  │  Webview     │  │  PiP Popout Window   │   │
│  │  (Vite)      │  │  (iframe)    │  │  (separate Browser-  │   │
│  │              │  │  player      │  │  Window)             │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Session Architecture

| Session | Purpose | User Agent | CSP Stripping | Ad Blocking |
|---|---|---|---|---|
| `default` | Main app navigation | Default Electron | No | No |
| `persist:player` | Streaming webviews | Chrome UA | Yes (remove CSP, X-Frame-Options) | Yes (BLOCKED_HOSTS) |
| `persist:trailer` | YouTube trailers | Chrome UA | Yes | Yes (limited) |

### 2.3 Window Types

| Window | Purpose | Frame | Title Bar | Notes |
|---|---|---|---|---|
| Main | App UI | Platform-dependent | macOS: hiddenInset, others: hidden | Min 900×600 |
| PiP Popout | Picture-in-Picture | macOS: false, Windows: false, Linux: true | CustomTitlebar on Linux | Popout preload only |

---

## 3. IPC Channel Map

### 3.1 invoke/handle Channels

| Channel | Direction | Handler | Purpose |
|---|---|---|---|
| `storage:get` | R▸M | `ipc/storage.js` | Read from electron-store |
| `storage:set` | R▸M | `ipc/storage.js` | Write to electron-store |
| `storage:delete` | R▸M | `ipc/storage.js` | Delete from electron-store |
| `window:minimize` | R▸M | `ipc/window.js` | Minimize window |
| `window:toggleMaximize` | R▸M | `ipc/window.js` | Toggle maximize |
| `window:close` | R▸M | `ipc/window.js` | Close window |
| `player:popout` | R▸M | `ipc/player.js` | Open PiP popout |
| `tmdb:fetch` | R▸M | `ipc/tmdb.js` | Proxy TMDB API request |
| `tmdb:getImageUrl` | R▸M | `ipc/tmdb.js` | Build TMDB image URL |
| `profile:create` | R▸M | `ipc/profiles.js` | Create profile |
| `profile:delete` | R▸M | `ipc/profiles.js` | Delete profile |
| `profile:list` | R▸M | `ipc/profiles.js` | List all profiles |
| `profile:get` | R▸M | `ipc/profiles.js` | Get single profile |
| `profile:update` | R▸M | `ipc/profiles.js` | Update profile |
| `profile:setActive` | R▸M | `ipc/profiles.js` | Set active profile ID |
| `profile:getActiveId` | R▸M | `ipc/profiles.js` | Get active profile ID |
| `profile:verifyPin` | R▸M | `ipc/profiles.js` | Verify profile PIN |
| `profile:verifyPassword` | R▸M | `ipc/profiles.js` | Verify profile password |
| `profile:updateSecurity` | R▸M | `ipc/profiles.js` | Update PIN/password |
| `profile:pickAvatar` | R▸M | `ipc/profiles.js` | Open file picker for avatar |
| `favorites:*` | R▸M | `ipc/library.js` | Favorites CRUD |
| `saved:*` | R▸M | `ipc/library.js` | Saved media CRUD |
| `progress:*` | R▸M | `ipc/library.js` | Progress tracking |
| `history:*` | R▸M | `ipc/library.js` | Watch history |
| `media:upsert` | R▸M | `ipc/library.js` | Upsert media record |
| `system:getMemoryInfo` | R▸M | `ipc/system.js` | Get memory usage |
| `system:clearCache` | R▸M | `ipc/system.js` | Clear app cache |
| `system:resetAllData` | R▸M | `ipc/system.js` | Reset all data |
| `downloads:*` | R▸M | `ipc/downloads.js` | Download management |
| `check-downloader` | R▸M | `ipc/downloads.js` | Verify external downloader |
| `check-bundled-downloader` | R▸M | `ipc/downloads.js` | Verify bundled vid-dl |
| `run-download` | R▸M | `ipc/downloads.js` | Execute download |
| `pick-folder` | R▸M | `ipc/downloads.js` | Open folder picker |
| `resolve-allmanga` | R▸M | `ipc/allmanga.js` | Resolve AllManga source |
| `set-player-video` | R▸M | `ipc/player.js` | Set video in webview |
| `get-block-stats` | R▸M | `ipc/blockStats.js` | Get blocked request stats |
| `get-platform` | R▸M | `main.js` | Get OS platform string |
| `record-blocked-popup` | R▸M | `main.js` | Record blocked popup |
| `feedback:openForm` | R▸M | `main.js` | Open feedback form |
| `shell:openPath` | R▸M | `main.js` | Open file in OS |
| `shell:showItemInFolder` | R▸M | `main.js` | Reveal file in explorer |
| `shell:openExternal` | R▸M | `main.js` | Open URL in browser |
| `app:quit` | R▸M | `main.js` | Quit the app |

### 3.2 send/on Channels (Main → Renderer)

| Channel | Purpose |
|---|---|
| `window:maximize-change` | Maximize state changes |
| `app-quitting` | App is about to quit |
| `m3u8-found` | HLS stream URL detected |
| `subtitle-found` | VTT subtitle URL detected |
| `download:progress` | Download progress update |
| `download:complete` | Download completed |
| `download:error` | Download error |
| `pip-state` | PiP window state change |
| `blocked-stats-update` | Blocked request count changed |

---

## 4. Data Flow

### 4.1 Search → Select → Play (Complete Flow)

```
1. SEARCH
   User types query ──▶ SearchOverlay.jsx ──▶ tmdb:fetch (IPC)
       ──▶ Main Process ──▶ TMDB API ──▶ Results returned to renderer

2. SELECT
   User clicks media ──▶ DetailView.jsx ──▶ tmdb:fetch (details, credits, videos)
       ──▶ Render detail page with metadata, cast, trailers

3. PLAY
   User clicks "Watch Now" ──▶ PlayerSection.jsx
       ├──▶ Resolve source URL (source.movieUrl or source.tvUrl)
       │       ──▶ If AllManga: resolve-allmanga (IPC) ──▶ GraphQL + hex cipher
       ├──▶ Create webview ──▶ Load source URL in persist:player session
       ├──▶ Start progress polling (every N seconds)
       │       ──▶ progress:update (IPC) ──▶ SQLite
       └──▶ Detect m3u8 URLs ──▶ m3u8-found (IPC) ──▶ Offer download
```

### 4.2 Source Switching

```
User clicks source button
    ──▶ PlayerSection navigates webview to new source URL
    ──▶ Progress polling continues with same mediaId
    ──▶ Popup/redirect interception re-initialized
    ──▶ Blocked stats session counter resets on playerUrl change
```

### 4.3 Data Persistence Pattern

```
User Action
    │
    ▼
Store (Zustand-like) ──▶ Optimistic UI update
    │
    ▼
IPC invocation ──▶ Main process ──▶ SQLite (better-sqlite3)
    │
    ▼
On next profile load: SQLite ──▶ Load all data into store
```

---

## 5. Database Schema

The database is managed by `@nexube/store` using `better-sqlite3`. Tables are created via `database.ts`.

### 5.1 Entity Relationship

```
profiles (1) ──▶ watchlist (N)
profiles (1) ──▶ favorites (N)
profiles (1) ──▶ saved (N)
profiles (1) ──▶ history (N)
profiles (1) ──▶ progress (N)
profiles (1) ──▶ settings (N)          [key-value per profile]
profiles (1) ──▶ search_history (N)
                   downloads            [standalone, linked by profile_id]
```

### 5.2 Tables

| Table | Key Columns | Constraints |
|---|---|---|
| `profiles` | id, name, avatar, is_kids, security_type, security_hash, created_at, last_used | PK id |
| `settings` | key, profile_id, value | PK (key, profile_id) |
| `watchlist` | id, profile_id, media_id, media_type, ... | UQ (profile_id, media_id, media_type) |
| `favorites` | id, profile_id, media_id, ... | UQ (profile_id, media_id) |
| `saved` | id, profile_id, media_id, ... | UQ (profile_id, media_id) |
| `history` | id, profile_id, media_id, season, episode, watched_at | FK profile_id |
| `progress` | id, profile_id, media_id, season, episode, progress, duration, completed | UQ (profile_id, media_id, season, episode) |
| `search_history` | id, profile_id, query, searched_at | FK profile_id |
| `downloads` | id, profile_id, url, title, status, progress, file_path, format | PK id |

---

## 6. Player System

### 6.1 Player Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                       PlayerSection.jsx                          │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐  │
│  │ Source      │  │  Webview     │  │  Sub/DUB + Controls     │  │
│  │ Resolution  │  │  (persist:   │  │  SkipButton, Source     │  │
│  │             │  │   player)    │  │  Switcher, PiP Popout   │  │
│  └─────────────┘  └──────────────┘  └─────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Progress Polling (setInterval every ~5s)                  │  │
│  │  executeJavaScript to get currentTime/duration from iframe │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  Popup/Redirect Blocking                                  │   │
│  │  webview.addEventListener('new-window') → block + record  │   │
│  │  webview.addEventListener('will-navigate') → block        │   │
│  └───────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### 6.2 Source Resolution

| Source | Provider | Key | Type |
|---|---|---|---|
| Videasy | `player.videasy.net` | `videasy` | Standard embed |
| VidAPI | `vaplayer.ru` | `vidapi` | Standard embed |
| VidSrc | `vidsrc.to` | `vidsrc` | Standard embed |
| AllManga | Custom resolver | `allmanga` | GraphQL + hex cipher + AES-256-CTR |

AllManga resolution runs in the main process via a local HTTP proxy started on demand. The resolver:
1. Queries a GraphQL endpoint for episode data
2. Decrypts the response using hex cipher + AES-256-CTR
3. Serves the decrypted stream URL via local proxy

### 6.3 PiP Popout

- Creates a separate `BrowserWindow` with minimal chrome
- Cross-platform frame config: macOS uses `hiddenInset`, Windows uses `frame: false`, Linux uses `frame: true` + `CustomTitlebar`
- Communicates via IPC (`pip-state` channel)
- Popout preload (`popout-preload.js`) exposes only `electron.close()`

### 6.4 Skip Button (AniSkip)

- Integrates with [AniSkip API](https://api.aniskip.com) for anime opening/ending times
- Fetches skip timestamps based on MAL ID + episode number
- Shows "Skip OP" / "Skip ED" button during playback

---

## 7. Profile System

### 7.1 Profile Types

| Type | Description | Security | Content Filtering |
|---|---|---|---|
| Master | Admin profile | Optional PIN/password | None |
| Standard | Regular user | Optional PIN/password | Configurable |
| Kids | Child profile | Always skips security overlay | Age-based filtering (G, PG, TV-Y, etc.) |

### 7.2 Profile Flow

```
App Start
    │
    ▼
Check for profiles ──▶ None? ──▶ SetupScreen (create first profile)
    │
    ▼
ProfileSelectScreen ──▶ Select profile
    │
    ▼
Check securityType ──▶ null? ──▶ Skip SecurityOverlay
    │                       │
    ▼                       ▼
SecurityOverlay ──▶ Verify PIN/password ──▶ Success? ──▶ Home
(PIN or password)            │
                        Failure? ──▶ Increment attempts, show feedback
```

### 7.3 Avatar System

- 6 built-in avatar images in `public/avatar1.png` through `avatar6.png`
- All profiles can change avatar via AvatarPicker
- Upload support for custom images via file dialog (`profile:pickAvatar`)
- `isMaster` flag determines access to advanced settings tabs

---

## 8. Settings System

### 8.1 Storage Layers

| Layer | Tool | Scope | Examples |
|---|---|---|---|
| `electron-store` | JSON file | Global (per-install) | TMDB API key, window bounds |
| SQLite `settings` table | Key-value | Per-profile | Accent color, download path, source |

### 8.2 Per-Profile Settings

| Setting | Type | Default |
|---|---|---|
| accent_color | string | `#6366f1` |
| download_path | string | User home |
| preferred_source | string | `videasy` |
| auto_mark_threshold | number | 20 (seconds remaining) |
| search_history | array (json) | `[]` |

Settings are stored in the SQLite `settings` table with `(key, profile_id, value)`. Global settings use `profile_id = NULL`.

---

## 9. Download System

### 9.1 Architecture

```
User clicks download ──▶ DownloadModal.jsx
    │
    ▼
Main process ──▶ Capture m3u8 URL (from player webview)
    │
    ▼
Spawn vid-dl subprocess ──▶ PyInstaller binary
    │                           │
    │                           ├── Downloads HLS stream
    │                           ├── Reports progress via stdout
    │                           └── Outputs mp4/mkv file
    │
    ▼
Progress reported back to renderer via download:progress IPC
```

### 9.2 Binary Path Resolution

```
Packaged app:  process.resourcesPath / vid-dl(.exe)
Dev mode:      path.resolve(__dirname, '../../resources/vid-dl/{platform}/vid-dl')
```

Extra resources configured per-platform in `package.json`:
- Windows: `resources/vid-dl/windows/vid-dl` → `vid-dl`
- Linux: `resources/vid-dl/linux/vid-dl` → `vid-dl`
- macOS: (pending addition)

### 9.3 Config (`download_config.ini`)

```ini
[DownloadOptions]
concurrent_fragment_downloads = 3
http_chunk_size = 1048576
download_folder = ~/Downloads/Nexube
max_concurrent_downloads = 2
```

---

## 10. Feedback System

### 10.1 Architecture

```
┌───────────────────────┐     POST /api/feedback     ┌──────────────────────┐
│  Nexube Desktop       │ ────────────────────────▸  │  Vercel Serverless   │
│  (FeedbackReport.jsx) │ ◂────────────────────────  │  Function            │
└───────────────────────┘     201 { success: true }  └──────────┬───────────┘
                                                                │
                                                          POST /repos/Aljayz/nexube/issues
                                                                │
                                                          ┌─────▼───────────┐
                                                          │  GitHub API     │
                                                          │  (GITHUB_TOKEN  │
                                                          │  from Vercel)   │
                                                          └─────────────────┘
```

### 10.2 Flow

1. User fills in FeedbackReport form (issue type, title, description)
2. App POSTs JSON to `https://nexube-feedback-api.vercel.app/api/feedback`
3. Serverless function validates input and creates GitHub issue via API
4. GitHub token is never exposed to the desktop app
5. Response returned to app with issue URL

---

## 11. Cross-Platform Considerations

### 11.1 Window Frames

| Platform | `frame` | `titleBarStyle` | Custom Titlebar |
|---|---|---|---|
| macOS | `false` | `hiddenInset` | Hidden (native traffic lights visible) |
| Windows | `true` | `hidden` | Visible (CustomTitlebar.jsx) |
| Linux | `true` | `hidden` | Visible (CustomTitlebar.jsx) |

### 11.2 vid-dl Binaries

| Platform | Binary | Built On |
|---|---|---|
| Windows | `vid-dl.exe` | Windows (PyInstaller) |
| Linux | `vid-dl` | Linux (PyInstaller) |
| macOS | `vid-dl` | macOS via GitHub Actions (cannot cross-compile from Linux) |

### 11.3 Platform Detection

- `get-platform` IPC returns `process.platform`
- Used to conditionally render frame components
- Platform-specific keyboard shortcuts use `(e.metaKey || e.ctrlKey)` for macOS compatibility

---

## 12. Security

### 12.1 Content Security Policy

Set via `onHeadersReceived` on the default session. Allows:
- `img-src`: TMDB image CDN, YouTube thumbnails
- `connect-src`: TMDB API, feedback proxy
- `frame-src`: All streaming sources (Videasy, VidAPI, VidSrc, YouTube)
- `script-src`: `'self' 'unsafe-inline'`

Player and trailer sessions strip CSP headers from upstream to allow embedded content.

### 12.2 Profile Security

- PINs use bcrypt hashing (10 salt rounds)
- Rate limiting: 5 attempts per 30-second window
- Kids profiles skip security overlay entirely
- Security type: `null` (none), `pin`, or `password`

### 12.3 Popup/Redirect Prevention

- `webview.addEventListener('new-window')` — intercepts and blocks
- `webview.addEventListener('will-navigate')` — validates navigation
- Blocked URLs recorded in blockStats for user visibility
- Blocked stats session counter resets on player URL change

### 12.4 Feedback Proxy

- No GitHub token embedded in the app
- Token stored as Vercel environment variable
- Proxy validates input before forwarding
- CORS headers allow requests from any origin
