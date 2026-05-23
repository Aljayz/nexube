const { ipcMain } = require('electron');
const Store = require('../lib/store');

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

const KIDS_CERT_MAP = {
  US: { lte: 'PG' },
  GB: { lte: 'PG' },
  DE: { lte: '6' },
  JP: { lte: 'G' },
  AU: { lte: 'PG' },
  CA: { lte: 'PG' },
  FR: { lte: 'TP' },
  IT: { lte: 'T' },
  ES: { lte: 'A' },
  BR: { lte: '10' },
  IN: { lte: 'U' },
  KR: { lte: 'All' },
};

async function tmdbFetch(endpoint, params = {}) {
  await _acquireSlot();
  try {
    const apiKey = store.get('tmdbApiKey');
    if (!apiKey) {
      throw new Error('TMDB API key not set');
    }

    const { kidsMode, ...apiParams } = params;

    if (kidsMode) {
      const country = store.get('kidsFilterCountry', 'US');
      const cert = KIDS_CERT_MAP[country] || KIDS_CERT_MAP.US;
      apiParams.include_adult = false;
      apiParams.certification_country = country;
      apiParams['certification.lte'] = cert.lte;
    }

    const cacheKey = `${endpoint}?${JSON.stringify(apiParams)}`;
    const cached = _tmdbCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < TMDB_CACHE_TTL) {
      return cached.data;
    }

    const url = new URL(`${TMDB_BASE}${endpoint}`);
    url.searchParams.append('api_key', apiKey);
    url.searchParams.append('language', apiParams.language || 'en-US');

    Object.entries(apiParams).forEach(([key, value]) => {
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

function getUsCertification(data, mediaType) {
  if (mediaType === 'tv' && data?.results) {
    const us = data.results.find((r) => r.iso_3166_1 === 'US');
    return us?.rating || null;
  }
  if (data?.results) {
    const us = data.results.find((r) => r.iso_3166_1 === 'US');
    if (us?.release_dates?.length > 0) {
      return us.release_dates[0].certification || null;
    }
  }
  return null;
}

function register() {
  ipcMain.handle('tmdb:fetch', async (_, endpoint, params) => {
    return tmdbFetch(endpoint, params);
  });

  ipcMain.handle('tmdb:getCertification', async (_, mediaType, tmdbId) => {
    const endpoint = mediaType === 'tv'
      ? `/tv/${tmdbId}/content_ratings`
      : `/movie/${tmdbId}/release_dates`;
    const data = await tmdbFetch(endpoint);
    return getUsCertification(data, mediaType);
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
