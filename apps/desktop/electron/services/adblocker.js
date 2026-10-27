'use strict';

/**
 * Brave-compatible ad blocking for Nexube.
 *
 * The network engine is Brave's own `brave/adblock-rust` (published to npm as
 * `adblock-rs`). The filter catalog comes from `brave/adblock-resources`, and
 * Brave's scriptlet/redirect resources come from the same project's generated
 * `resources.json`.
 *
 * Design notes:
 * - Electron only honours the most recently attached webRequest listener for a
 *   given event/session. This module owns that single `onBeforeRequest`
 *   listener per session and exposes `addRequestObserver()` so features such as
 *   the HLS capture service can observe the same stream of requests.
 * - The engine loads from a serialized cache in `userData` when possible. Until
 *   it is ready (and if it ever fails), the long-standing hard-coded host list
 *   remains active as a safety net.
 * - Cosmetic filtering is applied only to player/trailer sessions. Applying
 *   generic cosmetic rules to the main app UI would be unsafe.
 */

const { app, session, net } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const blockStats = require('../ipc/blockStats');

const CACHE_VERSION = 1;
const LIST_REFRESH_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 30 * 1000;
const FETCH_CONCURRENCY = 4;
const USER_AGENT = `Nexube/${app.getVersion()} (+https://github.com/Aljayz/nexube)`;

const ASSET_DIR = path.join(__dirname, '..', 'adblock');
const CATALOG_FILE = path.join(ASSET_DIR, 'list_catalog.json');
const RESOURCES_FILE = path.join(ASSET_DIR, 'resources.json');

// Player/trailer partitions get network + cosmetic filtering. The default
// session gets network filtering too so embedded trailers (YouTube iframes in
// the main window) are covered, but never cosmetic filtering.
const APP_ALLOW_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  'api.themoviedb.org',
  'image.tmdb.org',
  'nexube-feedback-api.vercel.app',
]);

// Exceptions appended to Brave's lists. These are Nexube-owned endpoints. If a
// future feature adds another first-party API host, add it here as well.
const NEXUBE_FILTERS = `
! Nexube application exceptions
@@||api.themoviedb.org^
@@||image.tmdb.org^
@@||nexube-feedback-api.vercel.app^
@@||sub.wyzie.io^
@@||api.subdl.com^
@@||dl.subdl.com^
@@||api.allanime.day^
@@||allanime.day^
@@||cdn.jsdelivr.net^
@@||api.github.com^
@@||github.com^
@@||objects.githubusercontent.com^
@@||localhost^
@@||127.0.0.1^
`.trim();

/**
 * Legacy hard-coded hosts. Kept as an emergency fallback while the Brave engine
 * is loading, and if the native binding cannot be loaded at all.
 *
 * These are Electron URL patterns (`*://host/path*`), not ABP filter syntax.
 */
const FALLBACK_PATTERNS = [
  '*://www.google-analytics.com/*',
  '*://analytics.google.com/*',
  '*://googletagmanager.com/*',
  '*://www.googletagmanager.com/*',
  '*://googletagservices.com/*',
  '*://doubleclick.net/*',
  '*://*.doubleclick.net/*',
  '*://adservice.google.com/*',
  '*://adservice.google.de/*',
  '*://pagead2.googlesyndication.com/*',
  '*://stats.g.doubleclick.net/*',
  '*://yt3.ggpht.com/ytc/*',
  '*://fonts.googleapis.com/*',
  '*://fonts.gstatic.com/*',
  '*://googleapis.com/*',
  '*://gstatic.com/*',
  '*://cdn.adx1.com/*',
  '*://intelligenceadx.com/*',
  '*://adsco.re/*',
  '*://mc.yandex.com/*',
  '*://mc.yandex.ru/*',
  '*://bvtpk.com/*',
  '*://my.rtmark.net/*',
  '*://b7510.com/*',
  '*://gt.unbrownunflat.com/*',
  '*://im.malocacomals.com/*',
  '*://users.videasy.net/*',
  '*://nf.sixmossin.com/*',
  '*://realizationnewestfangs.com/*',
  '*://acscdn.com/*',
  '*://lt.taloseempest.com/*',
  '*://pl26708123.profitableratecpm.com/*',
  '*://preferencenail.com/*',
  '*://protrafficinspector.com/*',
  '*://s10.histats.com/*',
  '*://weirdopt.com/*',
  '*://static.cloudflareinsights.com/*',
  '*://kettledroopingcontinuation.com/*',
  '*://wayfarerorthodox.com/*',
  '*://woxaglasuy.net/*',
  '*://adeptspiritual.com/*',
  '*://www.calculating-laugh.com/*',
  '*://amavhxdlofklxjg.xyz/*',
  '*://7jtjubf8p5kq7x3z2.u3qleufcm6vure326ktfpbj.cfd/*',
  '*://5mq.get64t9vqg8pnbex1y463o.rest/*',
  '*://usrpubtrk.com/*',
  '*://adexchangeclear.com/*',
  '*://rzjzjnavztycv.online/*',
  '*://tmstr4.cloudnestra.com/*',
  '*://tmstr4.neonhorizonworkshops.com/*',
  '*://cloudnestra.com/prorcp*',
];

const COMPILED_FALLBACK = FALLBACK_PATTERNS.map(compileFallbackPattern);

let initialized = false;
let engine = null;
let resourcesCache;
let loadPromise = null;
let refreshPromise = null;
let recoveryTimer = null;
let blockedCount = 0;

const managedSessions = new Map(); // Session -> { observers:Set, attached:boolean }
const cosmeticSessions = new Set();
const cosmeticTimers = new WeakMap();

let status = {
  state: 'fallback',
  source: null,
  lists: 0,
  bytes: 0,
  updatedAt: null,
  error: null,
};

function log(...args) {
  console.log('[adblock]', ...args);
}

function warn(...args) {
  console.warn('[adblock]', ...args);
}

// ---------------------------------------------------------------------------
// Paths / JSON helpers
// ---------------------------------------------------------------------------

function adblockDir() {
  return path.join(app.getPath('userData'), 'adblock');
}

function listsDir() {
  return path.join(adblockDir(), 'lists');
}

function engineFile() {
  return path.join(adblockDir(), 'engine.bin');
}

function engineMetaFile() {
  return path.join(adblockDir(), 'engine-meta.json');
}

function listsMetaFile() {
  return path.join(adblockDir(), 'lists-meta.json');
}

function ensureDirs() {
  fs.mkdirSync(listsDir(), { recursive: true });
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(file, value) {
  ensureDirs();
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value));
  fs.renameSync(tmp, file);
}

function writeFileAtomic(file, data) {
  ensureDirs();
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

function sha1(value) {
  return crypto.createHash('sha1').update(value).digest('hex');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function listFile(url) {
  return path.join(listsDir(), `${sha1(url)}.txt`);
}

// ---------------------------------------------------------------------------
// Filter catalog / list definitions
// ---------------------------------------------------------------------------

/**
 * Brave's catalog groups default lists into "components" (one catalog entry can
 * contain many source URLs). Flatten the default-enabled desktop entries and
 * de-duplicate URLs.
 */
function readListDefinitions() {
  const catalog = readJson(CATALOG_FILE, []);
  if (!Array.isArray(catalog)) {
    throw new Error('Brave filter catalog is missing or invalid');
  }

  const definitions = [];
  const seen = new Set();

  for (const entry of catalog) {
    if (!entry || !entry.default_enabled) continue;
    if (Array.isArray(entry.platforms) && entry.platforms.length > 0) {
      // Desktop builds use the entries without a platform restriction.
      if (!entry.platforms.includes('DESKTOP')) continue;
    }
    for (const source of entry.sources || []) {
      if (!source || !source.url || seen.has(source.url)) continue;
      if (source.format && source.format !== 'Standard') continue;
      seen.add(source.url);
      definitions.push({
        url: source.url,
        title: source.title || source.url,
        component: entry.title || entry.uuid || 'Brave',
      });
    }
  }

  if (definitions.length === 0) {
    throw new Error('Brave filter catalog contains no default desktop lists');
  }
  return definitions;
}

// ---------------------------------------------------------------------------
// List downloading / caching
// ---------------------------------------------------------------------------

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

async function downloadList(definition, previousMeta) {
  const file = listFile(definition.url);
  const headers = {
    'User-Agent': USER_AGENT,
    Accept: 'text/plain, */*',
  };
  if (previousMeta && previousMeta.etag) {
    headers['If-None-Match'] = previousMeta.etag;
  }
  if (previousMeta && previousMeta.lastModified) {
    headers['If-Modified-Since'] = previousMeta.lastModified;
  }

  let response;
  try {
    response = await net.fetch(definition.url, {
      headers,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    if (fs.existsSync(file)) {
      return {
        definition,
        file,
        meta: { ...previousMeta, checkedAt: Date.now(), error: err.message },
        changed: false,
        stale: true,
      };
    }
    throw err;
  }

  if (response.status === 304 && fs.existsSync(file)) {
    return {
      definition,
      file,
      meta: { ...previousMeta, checkedAt: Date.now() },
      changed: false,
    };
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${definition.url}`);
  }

  const text = await response.text();
  if (!text || text.length < 64) {
    throw new Error(`Empty filter list: ${definition.url}`);
  }

  writeFileAtomic(file, text);
  const digest = sha256(text);
  const changed = !previousMeta || previousMeta.sha256 !== digest;

  return {
    definition,
    file,
    changed,
    meta: {
      url: definition.url,
      title: definition.title,
      component: definition.component,
      etag: response.headers.get('etag') || '',
      lastModified: response.headers.get('last-modified') || '',
      fetchedAt: Date.now(),
      checkedAt: Date.now(),
      sha256: digest,
      bytes: Buffer.byteLength(text),
    },
  };
}

async function ensureLists(definitions, previousLists = []) {
  const previousByUrl = new Map(
    previousLists.filter(Boolean).map((item) => [item.url, item]),
  );

  const results = await mapLimit(
    definitions,
    FETCH_CONCURRENCY,
    async (definition) => {
      try {
        return await downloadList(
          definition,
          previousByUrl.get(definition.url) || null,
        );
      } catch (err) {
        const file = listFile(definition.url);
        if (fs.existsSync(file)) {
          const previous = previousByUrl.get(definition.url) || {};
          warn(`using cached list for ${definition.title}: ${err.message}`);
          return {
            definition,
            file,
            meta: { ...previous, checkedAt: Date.now(), error: err.message },
            changed: false,
            stale: true,
          };
        }
        warn(`failed to download ${definition.title}: ${err.message}`);
        return { definition, file: null, meta: null, changed: false, error: err.message };
      }
    },
  );

  const available = results.filter((item) => item.file && fs.existsSync(item.file));
  const changed = results.some((item) => item.changed);

  try {
    writeJsonAtomic(listsMetaFile(), {
      version: CACHE_VERSION,
      checkedAt: Date.now(),
      lists: available.map((item) => item.meta).filter(Boolean),
    });
  } catch (err) {
    warn(`could not save list metadata: ${err.message}`);
  }

  return { available, changed, errors: results.filter((item) => item.error) };
}

// ---------------------------------------------------------------------------
// Engine construction / serialization
// ---------------------------------------------------------------------------

function loadBinding() {
  // Required lazily so a missing native build degrades to the fallback list
  // instead of crashing the entire main process at startup.
  return require('adblock-rs');
}

function loadResources() {
  if (resourcesCache !== undefined) return resourcesCache;
  try {
    const parsed = JSON.parse(fs.readFileSync(RESOURCES_FILE, 'utf8'));
    resourcesCache = Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    warn(`could not load Brave resources: ${err.message}`);
    resourcesCache = [];
  }
  return resourcesCache;
}

function attachResources(target) {
  const resources = loadResources();
  if (!resources.length) return;
  try {
    target.useResources(resources);
  } catch (err) {
    warn(`could not attach Brave resources: ${err.message}`);
  }
}

function buildEngine(available) {
  const binding = loadBinding();
  const filterSet = new binding.FilterSet(false);
  let listCount = 0;
  let byteCount = 0;

  for (const item of available) {
    try {
      const text = fs.readFileSync(item.file, 'utf8');
      if (!text) continue;
      filterSet.addFilters(text);
      listCount++;
      byteCount += Buffer.byteLength(text);
    } catch (err) {
      warn(`could not parse ${item.definition.title}: ${err.message}`);
    }
  }

  if (listCount === 0) {
    throw new Error('No usable Brave filter lists were found');
  }

  try {
    filterSet.addFilters(NEXUBE_FILTERS);
  } catch (err) {
    warn(`could not add Nexube exceptions: ${err.message}`);
  }

  const built = new binding.Engine(filterSet);
  attachResources(built);

  return { engine: built, listCount, byteCount };
}

function writeEngineCache(built, available, source) {
  try {
    const serialized = Buffer.from(built.engine.serialize());
    writeFileAtomic(engineFile(), serialized);
    writeJsonAtomic(engineMetaFile(), {
      version: CACHE_VERSION,
      binding: 'adblock-rs',
      generatedAt: Date.now(),
      source,
      lists: available.map((item) => item.meta).filter(Boolean),
    });
    return serialized.length;
  } catch (err) {
    warn(`could not serialize engine: ${err.message}`);
    return 0;
  }
}

function engineCanary(target) {
  try {
    return (
      target.check(
        'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js',
        'https://example.com/',
        'script',
      ) === true
    );
  } catch {
    return false;
  }
}

function loadCachedEngine() {
  const meta = readJson(engineMetaFile(), null);
  if (!meta || meta.version !== CACHE_VERSION) return null;

  const file = engineFile();
  if (!fs.existsSync(file)) return null;

  try {
    const binding = loadBinding();
    const cached = new binding.Engine(new binding.FilterSet(false));
    const raw = fs.readFileSync(file);
    // adblock-rs' deserialize expects a JS ArrayBuffer. A Node Buffer is a
    // Uint8Array view and fails Neon's downcast, so pass the exact byte range.
    const arrayBuffer = raw.buffer.slice(
      raw.byteOffset,
      raw.byteOffset + raw.byteLength,
    );
    cached.deserialize(arrayBuffer);
    attachResources(cached);

    if (!engineCanary(cached)) {
      warn('cached engine failed its health check; rebuilding');
      return null;
    }

    return { engine: cached, meta };
  } catch (err) {
    warn(`could not load cached engine: ${err.message}`);
    return null;
  }
}

async function loadEngine() {
  status = { ...status, state: 'loading', error: null };

  const cached = loadCachedEngine();
  if (cached) {
    engine = cached.engine;
    status = {
      state: 'ready',
      source: 'cache',
      lists: (cached.meta.lists || []).length,
      bytes: (cached.meta.lists || []).reduce((sum, item) => sum + (item.bytes || 0), 0),
      updatedAt: cached.meta.generatedAt || null,
      error: null,
    };
    log(
      `loaded Brave engine from cache (${status.lists} lists, ${Math.round(status.bytes / 1024)} KiB)`,
    );
    scheduleRefresh(cached.meta);
    return;
  }

  const definitions = readListDefinitions();
  const previous = readJson(listsMetaFile(), { lists: [] });
  const { available, errors } = await ensureLists(definitions, previous.lists || []);

  if (available.length === 0) {
    throw new Error(
      errors.length
        ? `No filter lists available (${errors[0].error})`
        : 'No filter lists available',
    );
  }

  const built = buildEngine(available);
  engine = built.engine;
  const serializedBytes = writeEngineCache(built, available, 'download');

  status = {
    state: 'ready',
    source: 'download',
    lists: built.listCount,
    bytes: built.byteCount,
    updatedAt: Date.now(),
    error: null,
  };

  log(
    `built Brave engine (${built.listCount} lists, ${Math.round(built.byteCount / 1024)} KiB parsed, ` +
      `${Math.round(serializedBytes / 1024)} KiB serialized)`,
  );
}

function scheduleRefresh(meta) {
  const generatedAt = meta && meta.generatedAt ? meta.generatedAt : 0;
  if (Date.now() - generatedAt < LIST_REFRESH_MS) return;

  const timer = setTimeout(() => {
    refreshNow().catch((err) => warn(`list refresh failed: ${err.message}`));
  }, 10 * 1000);
  if (timer.unref) timer.unref();
}

/**
 * If the first load fails (for example the user starts the app offline with no
 * cached lists), keep trying in the background so the engine comes online as
 * soon as the network is available. The fallback host list protects the app in
 * the meantime.
 */
function scheduleRecovery() {
  if (recoveryTimer) return;
  recoveryTimer = setTimeout(async () => {
    recoveryTimer = null;
    if (engine) return;
    try {
      await refreshNow();
    } catch {
      scheduleRecovery();
    }
  }, 5 * 60 * 1000);
  if (recoveryTimer.unref) recoveryTimer.unref();
}

async function refreshNow() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    // If the initial load is still running, let it finish instead of starting a
    // second download/build pass.
    if (loadPromise && status.state === 'loading') {
      await loadPromise;
    }

    const hadEngine = !!engine;
    const definitions = readListDefinitions();
    const cachedMeta = readJson(engineMetaFile(), { lists: [] });
    const { available, changed, errors } = await ensureLists(
      definitions,
      cachedMeta.lists || [],
    );

    if (available.length === 0) {
      const message = errors.length
        ? `No filter lists available (${errors[0].error})`
        : 'No filter lists available';
      if (!hadEngine) throw new Error(message);
      log(`list check finished with ${errors.length} unreachable source(s)`);
      return;
    }

    if (hadEngine && !changed) {
      if (errors.length) {
        log(`list check finished with ${errors.length} unreachable source(s)`);
      }
      return;
    }

    const built = buildEngine(available);
    engine = built.engine;
    const source = hadEngine ? 'refresh' : 'download';
    const serializedBytes = writeEngineCache(built, available, source);
    status = {
      ...status,
      state: 'ready',
      source,
      lists: built.listCount,
      bytes: built.byteCount,
      updatedAt: Date.now(),
      error: null,
    };
    log(
      `${hadEngine ? 'refreshed' : 'recovered'} Brave engine (${built.listCount} lists, ` +
        `${Math.round(serializedBytes / 1024)} KiB serialized)`,
    );
  })()
    .catch((err) => {
      status = { ...status, error: err.message };
      throw err;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

// ---------------------------------------------------------------------------
// Fallback matching
// ---------------------------------------------------------------------------

function compileFallbackPattern(pattern) {
  const withoutScheme = pattern.replace(/^\*:\/\//, '');
  const slashIndex = withoutScheme.indexOf('/');
  const host = slashIndex === -1 ? withoutScheme : withoutScheme.slice(0, slashIndex);
  const pathPattern = slashIndex === -1 ? '' : withoutScheme.slice(slashIndex);
  const wildcardHost = host.startsWith('*.');
  const bareHost = wildcardHost ? host.slice(2) : host;

  let pathRegex = null;
  if (pathPattern) {
    const escaped = pathPattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    pathRegex = new RegExp(`^${escaped}$`);
  }

  return { bareHost, wildcardHost, pathRegex };
}

function isFallbackBlocked(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname || '/';

  for (const rule of COMPILED_FALLBACK) {
    const hostMatches = rule.wildcardHost
      ? host === rule.bareHost || host.endsWith(`.${rule.bareHost}`)
      : host === rule.bareHost;
    if (!hostMatches) continue;
    if (!rule.pathRegex || rule.pathRegex.test(path)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Network matching
// ---------------------------------------------------------------------------

function mapResourceType(type) {
  switch (type) {
    case 'mainFrame':
      return 'document';
    case 'subFrame':
      return 'subdocument';
    case 'xhr':
      return 'xmlhttprequest';
    case 'webSocket':
      return 'websocket';
    case 'cspReport':
      return 'csp_report';
    default:
      return (type || 'other').toLowerCase();
  }
}

function sourceUrlFor(details) {
  try {
    let frame = details.frame;
    for (let i = 0; frame && i < 5; i++) {
      if (frame.url && /^https?:/i.test(frame.url)) return frame.url;
      frame = frame.parent;
    }
  } catch {
    // Frame may already be destroyed.
  }

  if (details.referrer && /^https?:/i.test(details.referrer)) {
    return details.referrer;
  }
  return details.url;
}

function isAllowedHost(url) {
  try {
    const parsed = new URL(url);
    return APP_ALLOW_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function checkEngine(url, details) {
  if (!engine) return false;
  if (!/^https?:/i.test(url)) return false;
  if (isAllowedHost(url)) return false;

  try {
    return (
      engine.check(
        url,
        sourceUrlFor(details),
        mapResourceType(details.resourceType),
        (details.method || 'GET').toLowerCase(),
      ) === true
    );
  } catch (err) {
    // A malformed URL or an engine race should never break the request.
    return false;
  }
}

function recordBlock(details) {
  blockedCount++;
  try {
    blockStats.recordBlockedRequest(details.url);
  } catch {
    // Statistics must never affect request handling.
  }
}

function onBeforeRequest(entry, details, callback) {
  const url = details.url;

  if (!/^https?:/i.test(url) || isAllowedHost(url)) {
    callback({});
    return;
  }

  if (isFallbackBlocked(url)) {
    recordBlock(details);
    callback({ cancel: true });
    return;
  }

  // Never let a generic list take down a top-level player/page navigation.
  // Ads are loaded as subresources; blocking the document itself would replace
  // the player with an error page and break playback.
  if (details.resourceType !== 'mainFrame' && checkEngine(url, details)) {
    recordBlock(details);
    callback({ cancel: true });
    return;
  }

  for (const observer of entry.observers) {
    try {
      const decision = observer(details);
      if (decision && decision.cancel) {
        callback({ cancel: true });
        return;
      }
      if (decision && decision.redirectURL) {
        callback({ redirectURL: decision.redirectURL });
        return;
      }
    } catch (err) {
      warn(`request observer failed: ${err.message}`);
    }
  }

  callback({});
}

function sessionEntry(target) {
  let entry = managedSessions.get(target);
  if (!entry) {
    entry = { observers: new Set(), attached: false };
    managedSessions.set(target, entry);
  }
  return entry;
}

function attachSession(target) {
  const entry = sessionEntry(target);
  if (entry.attached) return entry;

  target.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
    onBeforeRequest(entry, details, callback);
  });
  entry.attached = true;
  return entry;
}

/**
 * Register a synchronous observer on a managed session. The observer receives
 * Electron's onBeforeRequest details after ad blocking has allowed the request.
 * Return `{ cancel: true }` or `{ redirectURL }` to take over the request.
 *
 * Returns an unsubscribe function. This replaces the previous (broken) pattern
 * of attaching a second onBeforeRequest listener and removing it with `null`,
 * which also removed the main ad blocker's listener.
 */
function addRequestObserver(target, observer) {
  const entry = attachSession(target);
  entry.observers.add(observer);
  return () => {
    entry.observers.delete(observer);
  };
}

// ---------------------------------------------------------------------------
// Cosmetic filtering
// ---------------------------------------------------------------------------

const COSMETIC_STYLE_ID = '__nexube_adblock_cosmetic';

const COLLECT_SELECTOR_DATA = `
(() => {
  const classes = new Set();
  const ids = new Set();
  const elements = document.querySelectorAll('*');
  const limit = Math.min(elements.length, 20000);
  for (let i = 0; i < limit; i++) {
    const el = elements[i];
    if (el.id) ids.add(el.id);
    if (el.classList) {
      for (const cls of el.classList) classes.add(cls);
    }
    if (classes.size >= 8000 && ids.size >= 8000) break;
  }
  return {
    classes: Array.from(classes).slice(0, 8000),
    ids: Array.from(ids).slice(0, 8000),
  };
})()
`;

function cosmeticCss(selectors) {
  return selectors
    .filter(Boolean)
    .map((selector) => `${selector}{display:none!important;}`)
    .join('\n');
}

async function applyCosmeticToFrame(frame) {
  if (!engine || !frame) return;

  let url;
  try {
    url = frame.url;
  } catch {
    return;
  }
  if (!url || !/^https?:/i.test(url)) return;

  let specific;
  try {
    specific = engine.urlCosmeticResources(url);
  } catch {
    return;
  }
  if (!specific) return;

  const selectors = new Set();
  const hideSelectors =
    specific.hide_selectors || specific.hideSelectors || [];
  if (Array.isArray(hideSelectors)) {
    for (const selector of hideSelectors) selectors.add(selector);
  }

  const genericDisabled =
    specific.generichide === true || specific.genericHide === true;
  if (!genericDisabled) {
    try {
      const data = await frame.executeJavaScript(COLLECT_SELECTOR_DATA);
      if (data && (data.classes.length || data.ids.length)) {
        const exceptions = Array.isArray(specific.exceptions)
          ? specific.exceptions
          : [];
        const generic = engine.hiddenClassIdSelectors(
          data.classes,
          data.ids,
          exceptions,
        );
        if (Array.isArray(generic)) {
          for (const selector of generic) selectors.add(selector);
        }
      }
    } catch {
      // Cross-origin/sandboxed frames may reject execution. Network blocking
      // still applies to them.
    }
  }

  const css = cosmeticCss(Array.from(selectors).slice(0, 20000));
  const script = `(function(){try{
    var id=${JSON.stringify(COSMETIC_STYLE_ID)};
    var style=document.getElementById(id);
    if(!style){
      style=document.createElement('style');
      style.id=id;
      (document.head||document.documentElement).appendChild(style);
    }
    style.textContent=${JSON.stringify(css)};
  }catch(e){}})();`;

  try {
    await frame.executeJavaScript(script);
  } catch {
    // Ignore frames that cannot be scripted.
  }
}

function framesFor(webContents) {
  try {
    const main = webContents.mainFrame;
    if (!main) return [];
    if (Array.isArray(main.framesInSubtree)) return main.framesInSubtree;
    return [main, ...main.frames];
  } catch {
    return [];
  }
}

async function applyCosmeticToFrames(webContents) {
  if (!engine || !webContents || webContents.isDestroyed()) return;
  const frames = framesFor(webContents);
  await Promise.allSettled(frames.map((frame) => applyCosmeticToFrame(frame)));
}

function scheduleCosmeticPass(webContents) {
  if (!webContents || webContents.isDestroyed()) return;
  applyCosmeticToFrames(webContents).catch(() => {});

  const existing = cosmeticTimers.get(webContents);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    cosmeticTimers.delete(webContents);
    applyCosmeticToFrames(webContents).catch(() => {});
  }, 2500);
  if (timer.unref) timer.unref();
  cosmeticTimers.set(webContents, timer);
}

function setupCosmetic(webContents) {
  if (!webContents || webContents.isDestroyed()) return;

  webContents.on('did-finish-load', () => scheduleCosmeticPass(webContents));
  webContents.on('did-frame-finish-load', () => scheduleCosmeticPass(webContents));
  webContents.on('did-navigate', () => scheduleCosmeticPass(webContents));
  webContents.on('did-navigate-in-page', (_event, _url, isMainFrame) => {
    if (isMainFrame) scheduleCosmeticPass(webContents);
  });
  webContents.once('destroyed', () => {
    const timer = cosmeticTimers.get(webContents);
    if (timer) clearTimeout(timer);
    cosmeticTimers.delete(webContents);
  });
}

function onWebContentsCreated(_event, webContents) {
  try {
    if (cosmeticSessions.has(webContents.session)) {
      setupCosmetic(webContents);
    }
  } catch {
    // Ignore webContents that are already gone.
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function init() {
  if (initialized) return;
  initialized = true;

  const targets = [
    session.defaultSession,
    session.fromPartition('persist:player'),
    session.fromPartition('persist:trailer'),
  ];

  for (const target of targets) {
    attachSession(target);
  }

  // Player and trailer sessions get cosmetic filtering. The default session
  // deliberately does not, to keep generic cosmetic rules away from the app UI.
  cosmeticSessions.add(session.fromPartition('persist:player'));
  cosmeticSessions.add(session.fromPartition('persist:trailer'));

  app.on('web-contents-created', onWebContentsCreated);

  const refreshTimer = setInterval(() => {
    refreshNow().catch((err) => warn(`periodic list refresh failed: ${err.message}`));
  }, 6 * 60 * 60 * 1000);
  if (refreshTimer.unref) refreshTimer.unref();

  loadPromise = loadEngine().catch((err) => {
    status = {
      state: 'error',
      source: null,
      lists: 0,
      bytes: 0,
      updatedAt: null,
      error: err.message,
    };
    warn(`Brave engine unavailable, using fallback host list: ${err.message}`);
    scheduleRecovery();
  });
}

function getStatus() {
  return {
    ...status,
    engine: 'brave/adblock-rust',
    binding: 'adblock-rs',
    fallbackPatterns: FALLBACK_PATTERNS.length,
    blockedRequests: blockedCount,
  };
}

function isReady() {
  return status.state === 'ready' && !!engine;
}

module.exports = {
  init,
  addRequestObserver,
  isFallbackBlocked,
  isReady,
  getStatus,
  refreshNow,
  whenReady: () => loadPromise || Promise.resolve(),
};
