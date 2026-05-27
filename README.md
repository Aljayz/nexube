# Nexube

> A desktop media streaming application built with Electron, React, and Vite — designed for multi-profile households with advanced playback control.

<p align="center">
  <img src="screenshots/app-view/Home.png" alt="Nexube Home Screen" width="800"/>
</p>

---
## Download Link
[Latest release (Nexube v0.2.4)](https://github.com/Aljayz/nexube/releases/tag/v0.2.4)

---
## Ranking
<a href="https://viberank.dev/apps/Nexube" target="_blank" rel="noopener noreferrer"><img src="https://viberank.dev/badge?app=Nexube&theme=dark" alt="Nexube on VibeRank" /></a>

---

## Features

### 🎬 Core Experience
- **Multi-Source Streaming Player** — Switch seamlessly between Videasy, VidAPI, VidSrc, and AllManga (anime) without leaving the player
- **Picture-in-Picture Mode** — Native PiP popout with cross-platform window frame configuration
- **Pop-up & Redirect Blocking** — Webview-level interception with per-session stats tracking
- **HLS Download Manager** — Stream capture via bundled `vid-dl` binary (PyInstaller), with progress tracking and queue management

### Multi-Profile System
- **Three Profile Types** — Master, Kids, and Standard profiles, each with independent settings
- **PIN/Password Protection** — Secure adult profiles while keeping Kids Mode accessible
- **Age-Based Content Filtering** — Automatic content restriction in Kids Mode
- **Per-Profile Settings** — Custom accent colors, download paths, preferred streaming source, auto-mark-watched threshold, and search history

### Content Management
- **Watchlist, History & Progress Tracking** — SQLite-persistent per profile, pick up where you left off
- **TMDB Integration** — Browse trending, popular, and top-rated content with rich metadata
- **Smart Search** — Search across movies and TV shows with history per profile

### Under the Hood
- **In-App Feedback System** — Report issues directly via serverless proxy → GitHub Issues
- **Keyboard-Driven Navigation** — Full shortcut support for power users
- **Cross-Platform** — Native installers for Windows (NSIS), Linux (AppImage, deb, pacman(soon)), and macOS (DMG)(soon)

---
## Future Support
- **Mobile Support**
- **macOS Native Build**
- **Custom Source Plugins**
- **Subtitle Support**

---

## Screenshots

<details>
<summary><strong>Setup & Onboarding</strong></summary>
<p align="center">
  <img src="screenshots/app-view/splash.png" alt="Splash Screen" width="400"/>
  <img src="screenshots/app-view/Setup.png" alt="TMDB API Setup" width="400"/>
  <img src="screenshots/app-view/setup-profile.png" alt="Profile Setup" width="400"/>
  <img src="screenshots/app-view/setup-profile-w-sec.png" alt="Profile with Security" width="400"/>
</p>
</details>

<details>
<summary><strong>Main Interface</strong></summary>
<p align="center">
  <img src="screenshots/app-view/Home.png" alt="Home" width="400"/>
  <img src="screenshots/app-view/Library.png" alt="Library" width="400"/>
  <img src="screenshots/app-view/Search.png" alt="Search" width="400"/>
  <img src="screenshots/app-view/Detail.png" alt="Content Detail" width="400"/>
  <img src="screenshots/app-view/Player.png" alt="Player" width="400"/>
  <img src="screenshots/app-view/NavSwitch.png" alt="Navigation Switch" width="400"/>
</p>
</details>

<details>
<summary><strong>Utilities & Settings</strong></summary>
<p align="center">
  <img src="screenshots/app-view/Download.png" alt="Download Manager" width="400"/>
  <img src="screenshots/app-view/Notif.png" alt="Notifications" width="400"/>
  <img src="screenshots/app-view/Settings.png" alt="Settings" width="400"/>
  <img src="screenshots/app-view/Help.png" alt="Help & Shortcuts" width="400"/>
  <img src="screenshots/app-view/notice.png" alt="Notice" width="400"/>
</p>
</details>

---

## Obtaining Your TMDB API Key

Nexube relies on [The Movie Database (TMDB)](https://www.themoviedb.org) to fetch all content metadata. To get started, you'll need to generate a free personal API key. Follow the steps below carefully.

1.  **Create or Log Into Your Account**
    Head over to [themoviedb.org](https://www.themoviedb.org). If you already have an account, simply sign in. Otherwise, fill out the registration form to create one.
    ![TMDB Sign Up/Login](screenshots/setup-view/setup/tmdb.png)

2.  **Activate Your Account**
    After signing up, check the inbox of the email address you used. You'll find an activation link—click it to verify and activate your account.
    ![Activation Email](screenshots/setup-view/setup/acvtivation.png)

3.  **Navigate to Account Settings**
    Once you're logged in and on the main landing page, click on your profile avatar in the top-right corner.
    ![Landing Page](screenshots/setup-view/setup/landing.png)
    A dropdown menu will appear. Select the **"Settings"** option.
    ![Settings Dropdown](screenshots/setup-view/setup/step-1.png)

4.  **Open the API Section**
    On the Settings page, locate the navigation menu on the left-hand side of your screen. Click on the **"API"** entry.
    ![API Sidebar Link](screenshots/setup-view/setup/step-2.png)

5.  **Generate a New API Key**
    You'll be taken to the API management page. Click the **"Create"** button to start the process of generating a new key.
    ![Create API Key Button](screenshots/setup-view/setup/step-3.png)

6.  **Choose the Key Type**
    A prompt will appear asking how you intend to use the API key. Select the **"Personal Use Only"** option. This is the appropriate choice for using Nexube.
    ![Personal Use Selection](screenshots/setup-view/setup/step-4.png)

7.  **Accept the Terms of Use**
    Read through the terms, then check the acknowledgment checkbox. Click the **"Yes, this is for personal use"** button to proceed.
    ![Terms of Use Acceptance](screenshots/setup-view/setup/step-5.png)

8.  **Complete the Application Form**
    Fill in the required details. You can devise a name of your own choosing or simply copy the pre-filled one. For the **"Application URL"**, you may use a link to your social media profile or any valid URL you have. **A quick tip:** the system sometimes requires a more elaborate application summary, so don't hesitate to expand the "Summary" field with a brief, clear description.
    ![Application Details Form](screenshots/setup-view/setup/step-6.png)

9.  **Reveal Your New Key**
    Once the API key is successfully created, you'll see it listed on the page. Click on the highlighted text representing your new key to view its full details.
    ![Reveal API Key](screenshots/setup-view/setup/step-7.png)

10. **Copy the API Key Value**
    After clicking the highlighted text, a section with data will expand below. Look for the random string of characters in the **"API Key"** field. Carefully copy this entire value—this is what you'll paste into Nexube.
    ![Copy API Key Value](screenshots/setup-view/setup/step-8.png)
> `Security Note:` API keys should always be kept strictly confidential. The key shown in this example has expired and is no longer active.
---

## Quick Start

### Prerequisites
- **Node.js** ≥ 18
- **pnpm** ≥ 9
- **Python** (for `vid-dl` downloader)

### Installation

```bash
# Clone the repository
git clone https://github.com/Aljayz/nexube.git
cd nexube/apps/desktop

# Install dependencies
pnpm install

# Run web-only dev server (hot reload, port 5173)
pnpm dev

# Run full Electron app in dev mode
pnpm electron:dev
```

---

## Available Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Vite dev server (renderer only, browser) |
| `pnpm build` | Production build of the renderer |
| `pnpm electron:dev` | Electron app with hot module replacement |
| `pnpm electron:build` | Full production build + platform packaging |

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd + K` or `Ctrl/Cmd + F` | Open search |
| `Ctrl/Cmd + Z` | Navigate back |
| `Ctrl/Cmd + R` | Reload app |
| `Ctrl/Cmd + X` | Logout |
| `Escape` | Close modal / exit player |
| `?` | Show help & shortcuts overlay |
| `Space` | Play / Pause |
| `F` | Toggle fullscreen |
| `←` / `→` | Seek backward / forward 10 seconds |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop Shell | Electron 28 |
| UI Framework | React 18 + Tailwind CSS 3 |
| Build System | Vite 5 + `vite-plugin-electron` |
| State & Database | SQLite via `@nexube/store` |
| Streaming | System webview (iframe embeds) |
| Packaging | electron-builder 24 |
| Monorepo | pnpm workspaces + Turborepo |

---

## Project Structure

```
nexube/
├── apps/desktop/
│   ├── electron/                  # Main process
│   │   ├── main.js                # Window creation, IPC registration
│   │   ├── preload.js             # Context bridge → window.electron.*
│   │   ├── popout-preload.js      # PiP window preload
│   │   ├── ipc/                   # IPC handlers (10 modules)
│   │   └── services/              # Downloader, HLS capture, source resolvers
│   ├── src/                       # Renderer (React)
│   │   ├── pages/                 # Route-level components (7 pages)
│   │   ├── components/            # Reusable UI (30+ components)
│   │   ├── hooks/                 # Custom React hooks (5)
│   │   └── App.jsx                # Root component
│   ├── scripts/                   # Build & utility scripts
│   ├── resources/                 # Bundled binaries (vid-dl per platform)
│   ├── public/                    # Static assets (icons, avatars)
│   ├── package.json
│   ├── vite.config.mjs
│   └── tailwind.config.js
├── packages/
│   ├── store/                     # @nexube/store — SQLite database layer
│   ├── types/                     # @nexube/types — Shared TypeScript definitions
│   ├── player-engine/             # @nexube/player-engine — Player logic
│   └── ui-tokens/                 # @nexube/ui-tokens — Design tokens
└── docs/
    ├── ARCHITECTURE.md
    ├── DEVELOPMENT.md
    └── FEEDBACK_SYSTEM_SETUP.md
```

---

## Building for Distribution

```bash
# Linux (AppImage + deb + pacman)
pnpm electron:build

# Windows (NSIS installer) — requires Wine on Linux
pnpm electron:build --win

# macOS (DMG) — requires macOS
pnpm electron:build --mac
```

Outputs are placed in `release/`.

---

## Documentation

- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** — System design, data flow, IPC map
- **[DEVELOPMENT.md](./docs/DEVELOPMENT.md)** — Setup guide, coding conventions, contributing
- **[FEEDBACK_SYSTEM_SETUP.md](./docs/FEEDBACK_SYSTEM_SETUP.md)** — Deploying the serverless feedback proxy

---

## Inspiration

This project was inspired by [Streambert](https://github.com/truelockmc/streambert) by [truelockmc](https://github.com/truelockmc). While Nexube is a completely independent implementation written from scratch, their work heavily influenced the concept and initial architecture.

---

## License

**GNU GPL-3.0** — see [LICENSE](./LICENSE) for full details.

Copyright © 2026 [Aljayz](https://github.com/Aljayz)
