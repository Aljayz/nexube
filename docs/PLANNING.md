# Nexube — Planning & Roadmap

> **Last Updated:** May 2026

---

## 1. GitHub Actions Workflows

| Workflow | File | Triggers | Purpose |
|---|---|---|---|
| **Build vid-dl (macOS)** | `.github/workflows/build-vid-dl-macos.yml` | Manual only (`workflow_dispatch`) | Compile macOS vid-dl binary via PyInstaller |
| **Release Build** | `.github/workflows/release.yml` | Manual + tag push (`v*`) | Build all platform installers (includes macOS vid-dl), create GitHub Release |

## 2. Release Process

```bash
# When ready to ship:
git tag v0.2.0
git push origin v0.2.0
# → release.yml builds everything and uploads to GitHub Releases
# → auto-updater detects new version on next app launch
```

## 3. Production Readiness Checklist

- [ ] macOS vid-dl binary (run workflow or compile manually)
- [ ] Code signing (Windows + macOS)
- [ ] Error boundaries on all lazy-loaded pages
- [ ] Release CI/CD pipeline (release.yml)
- [ ] Smoke test on Windows, macOS, Linux
- [ ] Fix `download_config.ini` tilde expansion in the downloader service
- [ ] App icon verified on all platforms

## 4. Roadmap

| Version | Focus | Status |
|---|---|---|
| v0.1.0 | Core features, profiles, player, downloads, settings | Active development |
| v0.2.0 | CI/CD, error boundaries, production polish | Planned |
| v1.0.0 | Signed installers, stable release | Future |

## 5. Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Package manager | pnpm + Turborepo | Fast, disk-efficient monorepo |
| Desktop framework | Electron 28 + Vite | Cross-platform, rich ecosystem |
| Database | SQLite via `@nexube/store` | Local, portable, no server |
| Streaming | System webview (iframe) | No bundled Chromium, proven approach |
| Binary downloader | PyInstaller (vid-dl) | HLS capture, bundled per platform |
| Feedback | Vercel proxy → GitHub Issues | No token in app, easy to deploy |
| Updates | `electron-updater` + GitHub Releases | Built-in, no extra infra |
| License | MIT | Open redistribution, credit required |
