const { ipcMain, shell, dialog, app } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const {
  addDownload,
  updateDownload,
  getDownloads,
  getDownload,
  deleteDownload,
  getActiveDownloads,
} = require('@nexube/store');
const { captureM3u8Url } = require('../services/hls-capture');
const { resolveAllmanga } = require('../ipc/allmanga');
const {
  checkDownloader,
  checkBundledAndRegister,
  resolveBinaryPath,
  startDownload,
  pauseDownload,
  resumeDownload,
  stopDownload,
  killDownload,
  cleanupPartialFiles,
  killAllDownloads,
  isDownloadActive,
} = require('../services/desk-downloader');

const downloadsStore = new Map();

function sendProgress(update) {
  const mw = getMainWindow();
  if (mw && !mw.isDestroyed()) {
    mw.webContents.send('desk-download:progress', update);
  }
}

function updateDownloadEntry(id, entry) {
  downloadsStore.set(id, entry);
}

let _getMainWindow = null;
function getMainWindow() {
  return typeof _getMainWindow === 'function' ? _getMainWindow() : null;
}

function register(getMainWindowFn) {
  _getMainWindow = getMainWindowFn;

  ipcMain.handle('desk-download:check-bundled', () => {
    return checkBundledAndRegister();
  });

  ipcMain.handle('desk-download:check-folder', (_, folderPath) => {
    const result = checkDownloader(folderPath);
    return result;
  });

  ipcMain.handle('desk-download:start', async (_, {
    binaryToken,
    m3u8Url,
    name,
    downloadPath,
    mediaId,
    mediaType,
    season,
    episode,
    posterPath,
    tmdbId,
    formatSpec,
    sourceId,
    cookies,
    referer,
  }) => {
    try {
      const binaryPath = resolveBinaryPath(binaryToken);
      if (!binaryPath) {
        return { ok: false, error: 'Desk downloader binary not found or token expired' };
      }

      const downloadId = `ddl-${Date.now()}-${crypto.randomUUID().slice(0, 9)}`;

      addDownload({
        id: downloadId,
        profileId: mediaId,
        mediaId: `${mediaType}-${tmdbId}`,
        quality: formatSpec || 'best',
        m3u8Url,
        season,
        episode,
        sourceId,
      });

      updateDownload(downloadId, {
        status: 'downloading',
        startedAt: new Date().toISOString(),
      });

      const result = startDownload({
        binaryPath,
        m3u8Url,
        name,
        downloadPath,
        mediaId,
        mediaType,
        season,
        episode,
        posterPath,
        tmdbId,
        formatSpec,
        downloadId,
        cookies,
        referer,
      }, sendProgress, () => Array.from(downloadsStore.values()), updateDownloadEntry, updateDownload);

      if (result.ok) {
        return { ok: true, id: result.id, downloadId };
      }
      return result;
    } catch (err) {
      return { ok: false, error: err.message || 'Failed to start download' };
    }
  });

  async function queueSingleDownload({
    profileId, mediaId, title, type, formatSpec, tmdbId,
    season, episode, sourceId, binaryToken, downloadPath,
    episodeTitle, translationType,
  }, batchId) {
    let resolvedBinaryPath = null;

    if (binaryToken) {
      resolvedBinaryPath = resolveBinaryPath(binaryToken);
    }

    if (!resolvedBinaryPath) {
      const bundledResult = checkBundledAndRegister();
      if (!bundledResult.exists) {
        return { success: false, error: 'No desk downloader binary found.' };
      }
      resolvedBinaryPath = resolveBinaryPath(bundledResult.token);
    }

    const basePath = path.join(
      downloadPath || path.join(require('os').homedir(), 'Downloads'),
      'Nexube'
    );
    const sanitizedTitle = title
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
      .replace(/\s+/g, ' ')
      .trim() || 'Unknown';

    let fileDir;
    let safeName;
    if (type === 'tv') {
      const seasonPadded = String(season || 1).padStart(2, '0');
      const epPadded = String(episode || 1).padStart(2, '0');
      const epDirName = episodeTitle
        ? `Episode ${epPadded} - ${episodeTitle.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim()}`
        : `E${epPadded}`;
      fileDir = path.join(basePath, 'TV', sanitizedTitle, `Season ${seasonPadded}`, epDirName);
      safeName = `${sanitizedTitle} - S${seasonPadded}E${epPadded}`;
      if (episodeTitle) safeName += ` - ${episodeTitle.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim()}`;
    } else {
      fileDir = path.join(basePath, 'Movies', sanitizedTitle);
      safeName = sanitizedTitle;
    }

    const db = require('@nexube/store').getDatabase();
    let existing;
    if (season != null && episode != null) {
      existing = db.prepare(
        `SELECT * FROM downloads WHERE media_id = ? AND season = ? AND episode = ? AND status != 'completed' ORDER BY added_at DESC LIMIT 1`
      ).get(mediaId, season, episode);
    } else {
      existing = db.prepare(
        `SELECT * FROM downloads WHERE media_id = ? AND season IS NULL AND episode IS NULL AND status != 'completed' ORDER BY added_at DESC LIMIT 1`
      ).get(mediaId);
    }

    if (existing) {
      if (existing.status === 'downloading' || existing.status === 'paused') {
        return { success: false, error: 'Already downloading', skipped: true };
      }
      if (isDownloadActive(existing.id)) {
        return { success: false, error: 'Download already in progress', skipped: true };
      }

      const { getSourceById } = require('../services/sources');
      const source = getSourceById(sourceId || 'videasy');
      if (!source) {
        return { success: false, error: 'Invalid source' };
      }

      let captured;

      if (sourceId === 'allmanga') {
        const allmangaResult = await resolveAllmanga({
          title,
          seasonNumber: season || 1,
          episodeNumber: episode || 1,
          isMovie: type === 'movie',
          translationType: translationType || 'sub',
        });
        if (allmangaResult?.ok) {
          captured = { m3u8Url: allmangaResult.url, referer: allmangaResult.referer || 'https://allmanga.to', cookies: '' };
        } else {
          captured = null;
        }
      } else {
        const playerUrl = typeof source.url === 'function'
          ? await source.url(type, tmdbId, season || 1, episode || 1)
          : source.url;
        const captureOpts = sourceId === 'vidsrc' ? { visible: true, autoPlay: false } : {};
        captured = await captureM3u8Url(playerUrl, 120000, captureOpts);
      }

      if (!captured) {
        return { success: false, error: 'Failed to capture video URL' };
      }

      if (existing.download_path) {
        const sep = path.sep;
        const marker = `${sep}Nexube${sep}`;
        const idx = existing.download_path.indexOf(marker);
        if (idx !== -1) {
          const correctedBase = existing.download_path.substring(0, idx) + sep + 'Nexube';
          if (type === 'tv') {
            const seasonPadded = String(season || 1).padStart(2, '0');
            const epPadded = String(episode || 1).padStart(2, '0');
            const epDirName = episodeTitle
              ? `Episode ${epPadded} - ${episodeTitle.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim()}`
              : `E${epPadded}`;
            fileDir = path.join(correctedBase, 'TV', sanitizedTitle, `Season ${seasonPadded}`, epDirName);
            safeName = `${sanitizedTitle} - S${seasonPadded}E${epPadded}`;
            if (episodeTitle) safeName += ` - ${episodeTitle.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim()}`;
          } else {
            fileDir = path.join(correctedBase, 'Movies', sanitizedTitle);
            safeName = sanitizedTitle;
          }
        }
      }

      fs.mkdirSync(fileDir, { recursive: true });

      db.prepare(
        `UPDATE downloads SET status = 'downloading', speed = NULL, error = NULL, process_id = NULL, started_at = ?, completed_at = NULL, m3u8_url = ?, referer = ?, cookies = ?, download_path = ?, quality = ?, source_id = ?, episode_name = ? WHERE id = ?`
      ).run(
        new Date().toISOString(),
        captured.m3u8Url, captured.referer, JSON.stringify(captured.cookies),
        fileDir, formatSpec || 'best', source.id, episodeTitle || null, existing.id
      );

      const result = startDownload({
        binaryPath: resolvedBinaryPath,
        m3u8Url: captured.m3u8Url,
        name: safeName,
        downloadPath: fileDir,
        mediaId,
        mediaType: type,
        season,
        episode,
        posterPath: null,
        tmdbId,
        formatSpec,
        downloadId: existing.id,
        initialProgress: existing.progress_percent || 0,
        cookies: captured.cookies,
        referer: captured.referer,
      }, sendProgress, () => Array.from(downloadsStore.values()), updateDownloadEntry, updateDownload);

      if (result.ok) {
        return { success: true, downloadId: existing.id, id: result.id };
      }
      return { success: false, error: result.error };
    }

    const downloadId = `ddl-${Date.now()}-${crypto.randomUUID().slice(0, 9)}`;

    const { getSourceById } = require('../services/sources');
    const source = getSourceById(sourceId || 'videasy');
    if (!source) {
      return { success: false, error: 'Invalid source' };
    }

    let captured;

    if (sourceId === 'allmanga') {
      const allmangaResult = await resolveAllmanga({
        title,
        seasonNumber: season || 1,
        episodeNumber: episode || 1,
        isMovie: type === 'movie',
        translationType: translationType || 'sub',
      });
      if (allmangaResult?.ok) {
        captured = { m3u8Url: allmangaResult.url, referer: allmangaResult.referer || 'https://allmanga.to', cookies: '' };
      } else {
        captured = null;
      }
    } else {
      const playerUrl = typeof source.url === 'function'
        ? await source.url(type, tmdbId, season || 1, episode || 1)
        : source.url;
      const captureOpts = sourceId === 'vidsrc' ? { visible: true, autoPlay: false } : {};
      captured = await captureM3u8Url(playerUrl, 120000, captureOpts);
    }

    if (!captured) {
      return { success: false, error: 'Failed to capture video URL' };
    }

    fs.mkdirSync(fileDir, { recursive: true });

    let collectionId = null;
    if (type === 'movie' && tmdbId) {
      try {
        const { tmdbFetch } = require('./tmdb');
        const details = await tmdbFetch(`/movie/${tmdbId}`);
        if (details?.belongs_to_collection?.id) {
          collectionId = details.belongs_to_collection.id;
        }
      } catch (e) {
        console.warn(`[desk-downloads] Failed to fetch collection for movie ${tmdbId}:`, e.message);
      }
    }

    addDownload({
      id: downloadId,
      profileId,
      mediaId,
      quality: formatSpec || 'best',
      m3u8Url: captured.m3u8Url,
      referer: captured.referer,
      cookies: JSON.stringify(captured.cookies),
      downloadPath: fileDir,
      season,
      episode,
      episodeName: episodeTitle,
      sourceId: source.id,
      collectionId,
      batchId: batchId || undefined,
    });

    const result = startDownload({
      binaryPath: resolvedBinaryPath,
      m3u8Url: captured.m3u8Url,
      name: safeName,
      downloadPath: fileDir,
      mediaId,
      mediaType: type,
      season,
      episode,
      posterPath: null,
      tmdbId,
      formatSpec,
      downloadId,
      cookies: captured.cookies,
      referer: captured.referer,
    }, sendProgress, () => Array.from(downloadsStore.values()), updateDownloadEntry, updateDownload);

    if (result.ok) {
      updateDownload(downloadId, {
        status: 'downloading',
        startedAt: new Date().toISOString(),
      });
      return { success: true, downloadId, id: result.id };
    }
    return { success: false, error: result.error };
  }

  ipcMain.handle('desk-download:queue', async (_, params) => {
    try {
      return await queueSingleDownload(params);
    } catch (err) {
      return { success: false, error: err.message || 'Failed to queue download' };
    }
  });

  // ── Queue processor ─────────────────────────────────────────────────────
  let _queueBusy = false;

  function _sendBatchProgress(batchId) {
    if (!batchId) return;
    const mw = getMainWindow();
    if (!mw || mw.isDestroyed()) return;
    try {
      const { getBatch } = require('@nexube/store');
      const batch = getBatch(batchId);
      if (!batch) return;
      const db = require('@nexube/store').getDatabase();
      const total = db.prepare("SELECT COUNT(*) as cnt FROM downloads WHERE batch_id = ?").get(batchId).cnt;
      const done = db.prepare("SELECT COUNT(*) as cnt FROM downloads WHERE batch_id = ? AND status IN ('completed','failed','error','cancelled','stopped','killed')").get(batchId).cnt;
      const completed = db.prepare("SELECT COUNT(*) as cnt FROM downloads WHERE batch_id = ? AND status = 'completed'").get(batchId).cnt;
      const failed = db.prepare("SELECT COUNT(*) as cnt FROM downloads WHERE batch_id = ? AND status IN ('failed','error')").get(batchId).cnt;
      mw.webContents.send('download:batch-progress', {
        batchId,
        title: batch.title,
        current: done,
        total,
        status: done >= total ? 'completed' : 'downloading',
        completed,
        failed,
        skipped: total - done - completed - failed,
      });
    } catch {}
  }

  function _pollUntilDone(downloadId) {
    return new Promise((resolve) => {
      const timer = setInterval(() => {
        try {
          const db = require('@nexube/store').getDatabase();
          const d = db.prepare("SELECT status FROM downloads WHERE id = ?").get(downloadId);
          if (!d || ['completed','failed','error','cancelled','stopped','killed'].includes(d.status)) {
            clearInterval(timer);
            resolve();
          }
        } catch {
          clearInterval(timer);
          resolve();
        }
      }, 2000);
    });
  }

  async function _processDownloadQueue() {
    if (_queueBusy) return;
    _queueBusy = true;
    try {
      while (true) {
        const db = require('@nexube/store').getDatabase();
        const item = db.prepare(`
          SELECT d.*, gm.title, gm.type AS media_type, gm.tmdb_id
          FROM downloads d
          INNER JOIN global_media gm ON d.media_id = gm.id
          WHERE d.status = 'queued'
          ORDER BY d.added_at ASC
          LIMIT 1
        `).get();
        if (!item) break;

        console.log(`[queue] processing queued download ${item.id}: ${item.title} S${item.season}E${item.episode}`);

        const { getSourceById } = require('../services/sources');
        const source = getSourceById(item.source_id || 'videasy');
        if (!source) {
          updateDownload(item.id, { status: 'failed', error: 'Invalid source' });
          _sendBatchProgress(item.batch_id);
          continue;
        }

        let captured;
        if (item.source_id === 'allmanga') {
          const allmangaResult = await resolveAllmanga({
            title: item.title,
            seasonNumber: item.season || 1,
            episodeNumber: item.episode || 1,
            isMovie: item.media_type === 'movie',
            translationType: 'sub',
          });
          if (allmangaResult?.ok) {
            captured = { m3u8Url: allmangaResult.url, referer: allmangaResult.referer || 'https://allmanga.to', cookies: '' };
          }
        } else {
          const playerUrl = typeof source.url === 'function'
            ? await source.url(item.media_type, item.tmdb_id, item.season || 1, item.episode || 1)
            : source.url;
          const captureOpts = item.source_id === 'vidsrc' ? { visible: true, autoPlay: false } : {};
          captured = await captureM3u8Url(playerUrl, 120000, captureOpts);
        }

        if (!captured) {
          updateDownload(item.id, { status: 'failed', error: 'Failed to capture video URL' });
          _sendBatchProgress(item.batch_id);
          continue;
        }

        let binaryPath = null;
        if (item.binary_token) binaryPath = resolveBinaryPath(item.binary_token);
        if (!binaryPath) {
          const bundled = checkBundledAndRegister();
          if (bundled.exists) binaryPath = resolveBinaryPath(bundled.token);
        }
        if (!binaryPath) {
          updateDownload(item.id, { status: 'failed', error: 'No downloader binary' });
          _sendBatchProgress(item.batch_id);
          continue;
        }

        const sanitized = (item.title || '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim() || 'Unknown';
        let safeName;
        if (item.media_type === 'tv') {
          const sPadded = String(item.season || 1).padStart(2, '0');
          const ePadded = String(item.episode || 1).padStart(2, '0');
          safeName = `${sanitized} - S${sPadded}E${ePadded}`;
          if (item.episode_name) safeName += ` - ${item.episode_name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim()}`;
        } else {
          safeName = sanitized;
        }

        const fileDir = item.download_path;
        if (!fileDir) {
          updateDownload(item.id, { status: 'failed', error: 'No download path' });
          _sendBatchProgress(item.batch_id);
          continue;
        }
        try { fs.mkdirSync(fileDir, { recursive: true }); } catch (e) {
          updateDownload(item.id, { status: 'failed', error: 'Cannot create directory' });
          _sendBatchProgress(item.batch_id);
          continue;
        }

        updateDownload(item.id, {
          status: 'downloading',
          m3u8Url: captured.m3u8Url,
          referer: captured.referer,
          cookies: JSON.stringify(captured.cookies),
          startedAt: new Date().toISOString(),
        });

        const result = startDownload({
          binaryPath,
          m3u8Url: captured.m3u8Url,
          name: safeName,
          downloadPath: fileDir,
          mediaId: item.media_id,
          mediaType: item.media_type,
          season: item.season,
          episode: item.episode,
          posterPath: null,
          tmdbId: item.tmdb_id,
          formatSpec: item.quality || 'best',
          downloadId: item.id,
          initialProgress: 0,
          cookies: captured.cookies,
          referer: captured.referer,
        }, sendProgress, () => Array.from(downloadsStore.values()), updateDownloadEntry, updateDownload);

        if (!result.ok) {
          updateDownload(item.id, { status: 'failed', error: result.error || 'Failed to start download' });
          _sendBatchProgress(item.batch_id);
          continue;
        }

        await _pollUntilDone(item.id);
        _sendBatchProgress(item.batch_id);
      }
    } finally {
      _queueBusy = false;
      setTimeout(() => _processDownloadQueue(), 0);
    }
  }

  ipcMain.handle('desk-download:queue-batch', async (_, params) => {
    const {
      type, mediaId, title, tmdbId, season, collectionId, items,
      sourceId, binaryToken, downloadPath, translationType, profileId, episodes,
    } = params;
    const { addBatch } = require('@nexube/store');

    let episodeList = [];
    if (type === 'season') {
      if (episodes && episodes.length > 0) {
        episodeList = episodes.map((ep) => ({
          episode: ep.episode,
          episodeTitle: ep.episodeTitle || null,
        }));
      } else {
        try {
          const { tmdbFetch } = require('./tmdb');
          const res = await tmdbFetch(`/tv/${tmdbId}/season/${season}`);
          episodeList = (res?.episodes || []).map((ep) => ({
            episode: ep.episode_number,
            episodeTitle: ep.name || null,
          }));
        } catch (e) {
          return { success: false, error: `Failed to fetch season ${season}: ${e.message}` };
        }
      }
    } else if (type === 'collection') {
      episodeList = (items || []).map((item) => ({
        mediaId: item.mediaId,
        title: item.title,
        tmdbId: item.tmdbId,
      }));
    }

    if (episodeList.length === 0) {
      return { success: false, error: 'No episodes or items to download' };
    }

    const batchTitle = type === 'season'
      ? `${title} - Season ${season}`
      : `${title} Collection`;

    const batchId = `batch-${Date.now()}-${crypto.randomUUID().slice(0, 9)}`;
    addBatch({
      id: batchId, profileId, title: batchTitle, type,
      mediaId, season, collectionId, total: episodeList.length,
    });

    const basePath = path.join(
      downloadPath || path.join(require('os').homedir(), 'Downloads'),
      'Nexube'
    );
    let queued = 0;
    let skipped = 0;

    for (const item of episodeList) {
      if (type === 'season') {
        const db = require('@nexube/store').getDatabase();
        const existing = db.prepare(
          "SELECT id FROM downloads WHERE media_id = ? AND season = ? AND episode = ? AND status = 'completed' LIMIT 1"
        ).get(mediaId, season, item.episode);
        if (existing) { skipped++; continue; }
      }

      const sanitizedTitle = title
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim() || 'Unknown';
      let fileDir;
      if (type === 'season') {
        const sPadded = String(season || 1).padStart(2, '0');
        const ePadded = String(item.episode).padStart(2, '0');
        const epDirName = item.episodeTitle
          ? `Episode ${ePadded} - ${item.episodeTitle.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim()}`
          : `E${ePadded}`;
        fileDir = path.join(basePath, 'TV', sanitizedTitle, `Season ${sPadded}`, epDirName);
      } else {
        fileDir = path.join(basePath, 'Movies', sanitizedTitle);
      }

      const downloadId = `ddl-${Date.now()}-${crypto.randomUUID().slice(0, 9)}`;

      const itemMediaId = type === 'season' ? mediaId : item.mediaId;

      let itemCollectionId = collectionId;
      if (type === 'collection' && !itemCollectionId) {
        try {
          const { tmdbFetch } = require('./tmdb');
          const details = await tmdbFetch(`/movie/${item.tmdbId}`);
          if (details?.belongs_to_collection?.id) itemCollectionId = details.belongs_to_collection.id;
        } catch {}
      }

      addDownload({
        id: downloadId,
        profileId,
        mediaId: itemMediaId,
        quality: 'best',
        downloadPath: fileDir,
        season: type === 'season' ? season : undefined,
        episode: type === 'season' ? item.episode : undefined,
        episodeName: type === 'season' ? item.episodeTitle : undefined,
        sourceId,
        collectionId: itemCollectionId,
        batchId,
        status: 'queued',
      });
      queued++;
    }

    _processDownloadQueue();

    return { success: true, batchId, queued, skipped };
  });

  ipcMain.handle('desk-download:pause', async (_, downloadId) => {
    try {
      const ok = pauseDownload(downloadId);
      if (ok) {
        updateDownload(downloadId, { status: 'paused' });
        const entry = downloadsStore.get(downloadId);
        if (entry) {
          entry.status = 'paused';
          entry.lastMessage = 'Paused';
          sendProgress({ id: downloadId, status: 'paused', lastMessage: 'Paused', progress: entry.progress || 0 });
        }
      }
      return { success: ok };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('desk-download:resume', async (_, downloadId) => {
    try {
      const ok = resumeDownload(downloadId);
      if (ok) {
        updateDownload(downloadId, { status: 'downloading' });
        const entry = downloadsStore.get(downloadId);
        if (entry) {
          entry.status = 'downloading';
          entry.lastMessage = 'Resumed';
          sendProgress({ id: downloadId, status: 'downloading', lastMessage: 'Resumed', progress: entry.progress || 0 });
        }
      }
      return { success: ok };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('desk-download:stop', async (_, downloadId) => {
    try {
      let ok = stopDownload(downloadId);
      if (!ok) {
        ok = killDownload(downloadId);
      }
      updateDownload(downloadId, { status: 'cancelled', completedAt: new Date().toISOString() });
      const entry = downloadsStore.get(downloadId);
      if (entry) {
        entry.status = 'stopped';
        entry.lastMessage = 'Stopped';
        entry.completedAt = Date.now();
        sendProgress({ id: downloadId, status: 'stopped', lastMessage: 'Stopped', progress: entry.progress || 0 });
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('desk-download:kill', async (_, downloadId) => {
    try {
      killDownload(downloadId);
      updateDownload(downloadId, { status: 'cancelled', completedAt: new Date().toISOString() });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('desk-download:delete', async (_, downloadId) => {
    try {
      killDownload(downloadId);
      const download = getDownload(downloadId);
      if (download) {
        const safeName = download.type === 'tv'
          ? `${download.title} - S${String(download.season || 1).padStart(2, '0')}E${String(download.episode || 1).padStart(2, '0')}${download.episode_name ? ` - ${download.episode_name}` : ''}`
          : `${download.title}`;
        cleanupPartialFiles({
          filePath: download.file_path,
          downloadPath: download.download_path,
          name: safeName,
          mediaType: download.type,
        });
      }
      deleteDownload(downloadId);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('desk-download:list', async (_, profileId) => {
    try {
      return getDownloads(profileId);
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('desk-download:getActive', async (_, profileId) => {
    try {
      return getActiveDownloads(profileId);
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('desk-download:play', async (_, downloadId) => {
    try {
      const download = getDownload(downloadId);
      if (!download || !download.file_path) {
        return { success: false, error: 'File not found' };
      }
      if (!fs.existsSync(download.file_path)) {
        return { success: false, error: 'File missing' };
      }
      const normalizedPath = download.file_path.replace(/\\/g, '/');
      const encodedPath = normalizedPath.split('/').map(s => encodeURIComponent(s)).join('/');
      return { success: true, filePath: `media:///${encodedPath.replace(/^\//, '')}` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('desk-download:play-external', async (_, downloadId) => {
    try {
      const download = getDownload(downloadId);
      if (!download || !download.file_path) {
        return { success: false, error: 'File not found' };
      }
      if (!fs.existsSync(download.file_path)) {
        return { success: false, error: 'File missing' };
      }

      const isTv = download.season != null;
      let playlist = [];

      if (isTv) {
        const db = require('@nexube/store').getDatabase();
        const rows = db.prepare(
          `SELECT * FROM downloads WHERE media_id = ? AND season = ? AND status = 'completed' AND file_path IS NOT NULL ORDER BY episode ASC`
        ).all(download.media_id, download.season);
        playlist = rows.filter((r) => fs.existsSync(r.file_path));
      } else if (download.collection_id) {
        const db = require('@nexube/store').getDatabase();
        const rows = db.prepare(
          `SELECT * FROM downloads WHERE collection_id = ? AND status = 'completed' AND file_path IS NOT NULL ORDER BY media_id ASC`
        ).all(download.collection_id);
        playlist = rows.filter((r) => fs.existsSync(r.file_path));
      } else {
        playlist = [download];
      }

      const hasPlaylist = isTv || download.collection_id;
      const selectedIndex = hasPlaylist ? playlist.findIndex((r) => r.id === downloadId) : 0;
      if (selectedIndex === -1) return { success: false, error: 'Episode not found in playlist' };

      const { spawn } = require('child_process');
      const vlcPath = findVlcPath();
      let player = 'vlc';

      if (vlcPath) {
        const vlcArgs = ['--loop'];
        if (hasPlaylist && selectedIndex > 0) {
          vlcArgs.push(`--playlist-start=${selectedIndex}`);
        }
        for (const item of playlist) {
          vlcArgs.push(item.file_path);
        }
        const child = spawn(vlcPath, vlcArgs, {
          detached: true,
          stdio: 'ignore',
        });
        child.unref();
      } else {
        player = 'default';
        shell.openPath(playlist[selectedIndex]?.file_path || download.file_path);
      }

      return { success: true, player, episodes: playlist.length };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  function findVlcPath() {
    const commonPaths = [
      'C:\\Program Files\\VideoLAN\\VLC\\vlc.exe',
      'C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Programs\\VLC\\vlc.exe'),
      path.join(process.env.PROGRAMFILES || '', 'VideoLAN\\VLC\\vlc.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || '', 'VideoLAN\\VLC\\vlc.exe'),
    ];
    for (const p of commonPaths) {
      if (fs.existsSync(p)) return p;
    }
    try {
      const { execSync } = require('child_process');
      const result = execSync('where vlc 2>nul', { encoding: 'utf8', timeout: 2000 }).trim();
      if (result) return result.split('\n')[0].trim();
    } catch {}
    return null;
  }

  ipcMain.handle('desk-download:kill-all', async () => {
    try {
      const db = require('@nexube/store').getDatabase();
      const active = db.prepare(
        `SELECT d.id, d.file_path, d.download_path, d.season, d.episode, d.episode_name, gm.title, gm.type
         FROM downloads d
         INNER JOIN global_media gm ON d.media_id = gm.id
         WHERE d.status = 'downloading' OR d.status = 'paused'`
      ).all();
      for (const dl of active) {
        if (dl.download_path && dl.title) {
          const safeName = dl.type === 'tv'
            ? `${dl.title} - S${String(dl.season || 1).padStart(2, '0')}E${String(dl.episode || 1).padStart(2, '0')}${dl.episode_name ? ` - ${dl.episode_name}` : ''}`
            : `${dl.title}`;
          cleanupPartialFiles({
            filePath: dl.file_path,
            downloadPath: dl.download_path,
            name: safeName,
            mediaType: dl.type,
          });
        }
        killDownload(dl.id);
        updateDownload(dl.id, { status: 'killed', completedAt: new Date().toISOString() });
        sendProgress({ id: dl.id, status: 'killed', lastMessage: 'Stopped', progress: 0 });
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('desk-download:batch-pause', async (_, batchId) => {
    try {
      const { getDownloadsByBatch, getBatch, updateBatch } = require('@nexube/store');
      const batch = getBatch(batchId);
      if (!batch) return { success: false, error: 'Batch not found' };
      const items = getDownloadsByBatch(batchId);

      for (const dl of items) {
        if (dl.status === 'downloading') {
          pauseDownload(dl.id);
          updateDownload(dl.id, { status: 'paused' });
          const entry = downloadsStore.get(dl.id);
          if (entry) {
            entry.status = 'paused';
            entry.lastMessage = 'Paused';
            sendProgress({ id: dl.id, status: 'paused', lastMessage: 'Paused', progress: entry.progress || 0 });
          }
        } else if (dl.status === 'queued') {
          updateDownload(dl.id, { status: 'paused' });
        }
      }
      updateBatch(batchId, { status: 'paused' });

      const mw = getMainWindow();
      if (mw && !mw.isDestroyed()) {
        mw.webContents.send('download:batch-progress', {
          batchId, title: batch.title,
          current: 0, total: 0, status: 'paused',
          completed: 0, failed: 0, skipped: 0,
        });
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('desk-download:batch-resume', async (_, batchId) => {
    try {
      const { getDownloadsByBatch, getBatch, updateBatch } = require('@nexube/store');
      const batch = getBatch(batchId);
      if (!batch) return { success: false, error: 'Batch not found' };
      const items = getDownloadsByBatch(batchId);

      for (const dl of items) {
        if (dl.status === 'paused') {
          if (dl.progress_percent > 0 || dl.started_at) {
            resumeDownload(dl.id);
            updateDownload(dl.id, { status: 'downloading' });
            const entry = downloadsStore.get(dl.id);
            if (entry) {
              entry.status = 'downloading';
              entry.lastMessage = 'Resumed';
              sendProgress({ id: dl.id, status: 'downloading', lastMessage: 'Resumed', progress: entry.progress || 0 });
            }
          } else {
            updateDownload(dl.id, { status: 'queued' });
          }
        }
      }
      updateBatch(batchId, { status: 'queuing' });
      _processDownloadQueue();

      const mw = getMainWindow();
      if (mw && !mw.isDestroyed()) {
        mw.webContents.send('download:batch-progress', {
          batchId, title: batch.title,
          current: 0, total: 0, status: 'queuing',
          completed: 0, failed: 0, skipped: 0,
        });
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('desk-download:batch-stop', async (_, batchId) => {
    try {
      const { getDownloadsByBatch, getBatch, updateBatch } = require('@nexube/store');
      const batch = getBatch(batchId);
      if (!batch) return { success: false, error: 'Batch not found' };
      const items = getDownloadsByBatch(batchId);

      for (const dl of items) {
        if (dl.status === 'downloading' || dl.status === 'paused') {
          killDownload(dl.id);
          const safeName = dl.type === 'tv'
            ? `${dl.title} - S${String(dl.season || 1).padStart(2, '0')}E${String(dl.episode || 1).padStart(2, '0')}${dl.episode_name ? ` - ${dl.episode_name}` : ''}`
            : `${dl.title}`;
          cleanupPartialFiles({
            filePath: dl.file_path,
            downloadPath: dl.download_path,
            name: safeName,
            mediaType: dl.type,
          });
          updateDownload(dl.id, { status: 'cancelled', completedAt: new Date().toISOString() });
        } else if (dl.status === 'queued') {
          updateDownload(dl.id, { status: 'cancelled', completedAt: new Date().toISOString() });
        }
      }
      updateBatch(batchId, { status: 'stopped' });

      const mw = getMainWindow();
      if (mw && !mw.isDestroyed()) {
        mw.webContents.send('download:batch-progress', {
          batchId, title: batch.title,
          current: 0, total: 0, status: 'stopped',
          completed: 0, failed: 0, skipped: 0,
        });
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('desk-download:batch-stop-delete', async (_, batchId) => {
    try {
      const { getDownloadsByBatch, getBatch } = require('@nexube/store');
      const batch = getBatch(batchId);
      if (!batch) return { success: false, error: 'Batch not found' };
      const items = getDownloadsByBatch(batchId);

      for (const dl of items) {
        if (dl.status === 'downloading' || dl.status === 'paused') {
          killDownload(dl.id);
          const safeName = dl.type === 'tv'
            ? `${dl.title} - S${String(dl.season || 1).padStart(2, '0')}E${String(dl.episode || 1).padStart(2, '0')}${dl.episode_name ? ` - ${dl.episode_name}` : ''}`
            : `${dl.title}`;
          cleanupPartialFiles({
            filePath: dl.file_path,
            downloadPath: dl.download_path,
            name: safeName,
            mediaType: dl.type,
          });
        }
        deleteDownload(dl.id);
      }

      const db = require('@nexube/store').getDatabase();
      db.prepare('DELETE FROM batches WHERE id = ?').run(batchId);

      const mw = getMainWindow();
      if (mw && !mw.isDestroyed()) {
        mw.webContents.send('download:batch-progress', {
          batchId,
          title: batch.title,
          current: 0, total: 0, status: 'deleted',
          completed: 0, failed: 0, skipped: 0,
        });
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('desk-download:scan', async (_, { profileId, downloadPath: scanPath }) => {
    try {
      const basePath = scanPath || path.join(require('os').homedir(), 'Downloads');
      const nexubeDir = path.join(basePath, 'Nexube');

      const scanDirs = [];
      if (fs.existsSync(nexubeDir)) {
        scanDirs.push(nexubeDir);
      } else {
        for (const sub of ['Movies', 'TV']) {
          const d = path.join(basePath, sub);
          if (fs.existsSync(d)) scanDirs.push(d);
        }
      }
      if (scanDirs.length === 0) return { found: 0, imported: 0, files: [] };

      const VIDEO_EXTS = ['.mp4', '.mkv', '.webm'];
      const foundFiles = [];

      function walkDir(dir) {
        let entries;
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walkDir(fullPath);
          } else if (entry.isFile() && VIDEO_EXTS.some((e) => entry.name.toLowerCase().endsWith(e))) {
            foundFiles.push(fullPath);
          }
        }
      }

      for (const d of scanDirs) walkDir(d);
      if (foundFiles.length === 0) return { found: 0, imported: 0, files: [] };

      const db = require('@nexube/store').getDatabase();
      let imported = 0;
      const results = [];

      for (const filePath of foundFiles) {
        const existing = db.prepare('SELECT id FROM downloads WHERE file_path = ?').get(filePath);
        if (existing) continue;

        const rel = path.relative(scanDir, filePath);
        const parts = rel.split(path.sep);
        let mediaType = 'movie';
        let title = '';
        let season = null;
        let episode = null;

        if (parts[0] === 'Movies' && parts.length >= 2) {
          mediaType = 'movie';
          title = parts[1];
        } else if (parts[0] === 'TV' && parts.length >= 4) {
          mediaType = 'tv';
          title = parts[1];
          const seasonMatch = parts[2]?.match(/Season\s*(\d+)/i);
          if (seasonMatch) season = parseInt(seasonMatch[1], 10);
          const epMatch = parts[3]?.match(/E(\d+)/i);
          if (epMatch) episode = parseInt(epMatch[1], 10);
        } else {
          title = path.basename(filePath, path.extname(filePath));
          mediaType = parts[0] === 'TV' ? 'tv' : 'movie';
        }

        const sanitizedTitle = title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim() || 'Unknown';
        const mediaId = `scan-${mediaType}-${sanitizedTitle.replace(/\s+/g, '-').toLowerCase()}`;
        const downloadId = `scan-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;

        db.prepare(
          `INSERT OR IGNORE INTO global_media (id, tmdb_id, title, type) VALUES (?, ?, ?, ?)`
        ).run(mediaId, -1, sanitizedTitle, mediaType);

        db.prepare(
          `INSERT INTO downloads (id, profile_id, media_id, file_path, download_path, status, season, episode, completed_at, size)
           VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, datetime('now'), ?)`
        ).run(
          downloadId,
          profileId || 'master-id',
          mediaId,
          filePath,
          path.dirname(filePath),
          season,
          episode,
          fs.statSync(filePath).size
        );

        const stat = fs.statSync(filePath);
        results.push({
          id: downloadId,
          title: sanitizedTitle,
          type: mediaType,
          season,
          episode,
          filePath,
          size: stat.size,
        });
        imported++;
      }

      return { found: foundFiles.length, imported, files: results };
    } catch (err) {
      return { found: 0, imported: 0, error: err.message, files: [] };
    }
  });

  ipcMain.handle('desk-download:pick-folder', async (_, { defaultPath } = {}) => {
    const opts = {
      properties: ['openDirectory'],
      title: 'Select Folder',
    };
    if (defaultPath && fs.existsSync(defaultPath)) {
      opts.defaultPath = defaultPath;
    }
    const result = await dialog.showOpenDialog(null, opts);
    const mw = getMainWindow();
    if (mw && !mw.isDestroyed()) {
      if (mw.isMinimized()) mw.restore();
      mw.show();
      mw.focus();
    }
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('desk-download:default-path', () => {
    return path.join(app.getPath('downloads'), 'Nexube');
  });

  ipcMain.handle('desk-download:show-in-folder', (_, filePath) => {
    if (filePath && fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
    }
  });

  _processDownloadQueue();
}

module.exports = { register, killAllDownloads };
