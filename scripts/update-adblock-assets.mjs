/**
 * Refresh the bundled Brave adblock metadata.
 *
 * Run with: pnpm update:adblock
 *
 * The filter lists themselves are downloaded and cached at runtime in
 * userData/adblock (they change daily). This script only refreshes the catalog
 * and the scriptlet/redirect resources that ship with the app.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = path.join(root, 'apps', 'desktop', 'electron', 'adblock');

const assets = [
  {
    url: 'https://raw.githubusercontent.com/brave/adblock-resources/master/filter_lists/list_catalog.json',
    file: 'list_catalog.json',
  },
  {
    url: 'https://raw.githubusercontent.com/brave/adblock-resources/master/dist/resources.json',
    file: 'resources.json',
  },
];

await fs.mkdir(destination, { recursive: true });

for (const asset of assets) {
  const response = await fetch(asset.url, {
    headers: { 'User-Agent': 'Nexube-adblock-assets/1.0' },
  });
  if (!response.ok) {
    throw new Error(`Failed to download ${asset.url}: HTTP ${response.status}`);
  }
  const text = await response.text();
  if (!text || text.length < 100) {
    throw new Error(`Refusing to write empty asset from ${asset.url}`);
  }
  const target = path.join(destination, asset.file);
  await fs.writeFile(target, text);
  console.log(`Updated ${path.relative(root, target)} (${text.length} bytes)`);
}
