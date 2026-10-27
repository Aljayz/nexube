# Brave ad blocking assets

Nexube uses Brave's own ad-blocking engine, not a reimplementation.

- `adblock-rs` (npm) is the Node binding for
  [`brave/adblock-rust`](https://github.com/brave/adblock-rust), the engine that
  powers Brave Shields. It is built from source by Cargo during installation.
- `list_catalog.json` is Brave's default filter-list catalog from
  [`brave/adblock-resources`](https://github.com/brave/adblock-resources).
  Nexube flattens the `default_enabled` desktop entries and downloads those
  lists at runtime. Updating the lists does not require an app update.
- `resources.json` is Brave's generated scriptlet/redirect resource bundle from
  the same repository. It is passed to `Engine.useResources()`.

Run `pnpm update:adblock` from the repository root to refresh the catalog and
resources bundle. Filter lists are refreshed automatically at most once a day;
the parsed engine is serialized to `userData/adblock/engine.bin` so startup is
fast.

## Licensing

- `brave/adblock-rust` and `brave/adblock-resources`: MPL-2.0.
- Filter lists belong to their upstream projects. See each list's header for
  its license. They are downloaded at runtime and cached per user rather than
  redistributed with the app.
- `adblock-rs` and its native build are included in packaged builds under their
  respective licenses.

## Native build requirement

`adblock-rs` is a Neon/N-API addon. Building it requires:

- Rust (stable) and Cargo
- A C toolchain (MSVC Build Tools on Windows; Clang/GCC on macOS/Linux)

CI and release machines must have these tools. The root `postinstall` script
only rebuilds the SQLite native module; `adblock-rs` builds itself through its
own `postinstall` hook.
