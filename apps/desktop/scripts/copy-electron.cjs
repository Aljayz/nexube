const { existsSync, mkdirSync, copyFileSync, readdirSync } = require('fs');
const { join } = require('path');

const rootDir = process.cwd();
const srcIpc = join(rootDir, 'electron', 'ipc');
const destIpc = join(rootDir, 'dist-electron', 'ipc');
const srcServices = join(rootDir, 'electron', 'services');
const destServices = join(rootDir, 'dist-electron', 'services');

function copyDir(src, dest) {
  if (!existsSync(src)) return;
  if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
  readdirSync(src).forEach(file => {
    copyFileSync(join(src, file), join(dest, file));
  });
}

copyDir(srcIpc, destIpc);
copyDir(srcServices, destServices);

console.log('Copied IPC and services files to dist-electron/');
