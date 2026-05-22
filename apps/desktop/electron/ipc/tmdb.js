const { ipcMain } = require('electron');
const Store = require('electron-store');

const store = new Store({ name: 'nexube-settings' });

const _tmdbCache = new Map();
const TMDB_CACHE_TTL = 5 * 60 * 1000;
const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p/';

let _inflight = 0;
const MAX_INFLIGHT = 4;
const _waiters = [];

function _acquireSlot() {
  if (_inflight < MAX_INFLIGHT) {
    _inflight++;
    return Promise.resolve();
  }
  return new Promise((resolve) => _waiters.push(resolve));
}

function _releaseSlot() {
  _inflight--;
  if (_waiters.length > 0) {
    const next = _waiters.shift();
    next();
  }
}

function _evictCache() {
  if (_tmdbCache.size > 80) {
    const keys = Array.from(_tmdbCache.keys());
    for (let i = 0; i < 20; i++) {
      _tmdbCache.delete(keys[i]);
    }
  }
}

async function tmdbFetch(endpoint, params = {}) {
  await _acquireSlot();
  try {
    const apiKey = store.get('tmdbApiKey');
    if (!apiKey) {
      throw new Error('TMDB API key not set');
    }

    const cacheKey = `${endpoint}?${JSON.stringify(params)}`;
    const cached = _tmdbCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < TMDB_CACHE_TTL) {
      return cached.data;
    }

    const url = new URL(`${TMDB_BASE}${endpoint}`);
    url.searchParams.append('api_key', apiKey);
    url.searchParams.append('language', params.language || 'en-US');

    Object.entries(params).forEach(([key, value]) => {
      if (key !== 'language') {
        url.searchParams.append(key, String(value));
      }
    });

    const response = await fetch(url.toString());
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.status_message || 'TMDB API error');
    }

    const data = await response.json();
    _tmdbCache.set(cacheKey, { data, timestamp: Date.now() });
    _evictCache();

    return data;
  } finally {
    _releaseSlot();
  }
}

function register() {
  ipcMain.handle('tmdb:fetch', async (_, endpoint, params) => {
    return tmdbFetch(endpoint, params);
  });

  ipcMain.handle('tmdb:getImageUrl', (_, path, size = 'w500') => {
    if (!path) return null;
    return `${IMAGE_BASE}${size}${path}`;
  });

  ipcMain.handle('tmdb:setApiKey', async (_, apiKey) => {
    store.set('tmdbApiKey', apiKey);
    return true;
  });

  ipcMain.handle('tmdb:getApiKey', async () => {
    return store.get('tmdbApiKey') || '';
  });
}

function clearCache() {
  _tmdbCache.clear();
}

module.exports = { register, tmdbFetch, clearCache };
