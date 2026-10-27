#!/usr/bin/env node
/*
 * Rebuilds better-sqlite3 against the Electron runtime.
 *
 * A normal `pnpm install` compiles native modules for the Node.js ABI, but the
 * app loads them from Electron's main process, which uses a different ABI.
 * Pull the matching prebuilt binary so `pnpm electron:dev` works without
 * requiring a local C++ toolchain.
 */
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const betterSqliteDir = path.join(root, 'node_modules', 'better-sqlite3');

if (!fs.existsSync(path.join(betterSqliteDir, 'package.json'))) {
  console.log('[native] better-sqlite3 is not installed, skipping Electron prebuild');
  process.exit(0);
}

let prebuildInstall;
try {
  prebuildInstall = require.resolve('prebuild-install/bin.js', { paths: [root] });
} catch {
  console.warn('[native] prebuild-install is not installed, skipping Electron prebuild');
  process.exit(0);
}

let electronVersion;
try {
  electronVersion = require(path.join(root, 'node_modules', 'electron', 'package.json')).version;
} catch {
  electronVersion = require(path.join(root, 'apps', 'desktop', 'package.json')).build.electronVersion;
}

console.log(`[native] installing better-sqlite3 prebuild for Electron ${electronVersion}`);
const result = spawnSync(
  process.execPath,
  [prebuildInstall, '--runtime', 'electron', '--target', electronVersion],
  { cwd: betterSqliteDir, stdio: 'inherit' },
);

if (result.status !== 0) {
  console.error('[native] Failed to install the Electron prebuild for better-sqlite3.');
  console.error(
    `[native] Retry manually: cd node_modules/better-sqlite3 && node ../prebuild-install/bin.js -r electron -t ${electronVersion}`,
  );
  process.exit(result.status || 1);
}
