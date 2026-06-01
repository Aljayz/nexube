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
const { searchSubtitles, downloadAndSaveSubtitles } = require('../services/desk-subtitles');
const { getStore } = require('./storage');
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
  remuxToMp4,
  remuxToFile,
  isMpegTs,
  setDiagCallback,
} = require('../services/desk-downloader');

const downloadsStore = new Map();
const _remuxingDownloads = new Set();

const LANGUAGE_NAMES = {
  en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian',
  pt: 'Portuguese', 'pt-BR': 'Brazilian Portuguese', ru: 'Russian', ja: 'Japanese',
  ko: 'Korean', zh: 'Chinese', ar: 'Arabic', nl: 'Dutch',
  pl: 'Polish', sv: 'Swedish', da: 'Danish', fi: 'Finnish', nb: 'Norwegian',
  tr: 'Turkish', cs: 'Czech', hu: 'Hungarian', ro: 'Romanian', vi: 'Vietnamese',
  th: 'Thai', id: 'Indonesian',
};
function getLanguageName(code) { return LANGUAGE_NAMES[code] || code; }

function diag(...args) {
  const msg = '[remux-diag] ' + args.map(a => typeof a === 'object' && a !== null ? JSON.stringify(a) : a).join(' ');
  console.log(msg);
  const mw = getMainWindow();
  if (mw && !mw.isDestroyed()) {
    mw.webContents.send('desk-download:diag', msg);
  }
}

function sendProgress(update) {
  console.log('[remux-flow] sendProgress:', JSON.stringify({ status: update.status, id: update.id ? update.id.slice(0, 8) : null, filePath: update.filePath ? 'yes' : 'no', exists: update.filePath ? fs.existsSync(update.filePath) : null }));
  const mw = getMainWindow();
  if (update.status === 'completed' && update.filePath && update.id && fs.existsSync(update.filePath)) {
    diag('sendProgress: completed with filePath, checking remux queue');
    if (_remuxingDownloads.has(update.id)) {
      diag('sendProgress: already in remux queue, skipping');
      return;
    }
    _remuxingDownloads.add(update.id);
    try {
      const vaultName = moveToVault(update.id, update.filePath);
      const vaultPath = path.join(getVaultDir(), vaultName);
      diag('sendProgress: moved to vault', vaultPath);
      completeWithRemux(update.id, vaultPath, update);
    } catch (e) {
      diag('sendProgress: vault move failed:', e.message);
      console.warn('[remux] vault move failed:', e);
      _remuxingDownloads.delete(update.id);
    }
    return;
  }
  if (mw && !mw.isDestroyed()) {
    mw.webContents.send('desk-download:progress', update);
  }
}

async function completeWithRemux(downloadId, vaultPath, update) {
  diag('completeWithRemux: start', { downloadId, vaultPath });
  try {
    const download = getDownload(downloadId);
    if (!download) throw new Error('Download not found');
    const vaultDir = getVaultDir();
    const vaultName = path.basename(vaultPath);

    // Check if remux is needed — skip temp file if already proper MP4
    const needsRemux = await isMpegTs(vaultPath);
    diag('completeWithRemux: isMpegTs =', needsRemux);

    if (needsRemux) {
      const remuxTmpPath = path.join(vaultDir, `.${vaultName}.remux.tmp`);
      diag('completeWithRemux: calling remuxToFile');
      const ok = await remuxToFile(vaultPath, remuxTmpPath);
      diag('completeWithRemux: remuxToFile returned', ok);
      if (ok) {
        try { fs.unlinkSync(vaultPath); } catch {}
        fs.renameSync(remuxTmpPath, vaultPath);
      } else {
        diag('completeWithRemux: remuxToFile failed, keeping original');
        try { if (fs.existsSync(remuxTmpPath)) fs.unlinkSync(remuxTmpPath); } catch {}
      }
    } else {
      diag('completeWithRemux: already proper format, no remux needed');
    }

    updateDownload(downloadId, { vaultPath: vaultName, remuxPath: null, filePath: null });
    diag('completeWithRemux: success, updated DB');

    const store = getStore();
    const wyzieApiKey = store.get('wyzieApiKey');
    const subtitleLanguages = store.get('subtitleLanguages') || ['en'];
    if (wyzieApiKey && download.tmdb_id) {
      try {
        const subtitles = await searchSubtitles({
          tmdbId: download.tmdb_id,
          type: download.type,
          season: download.season,
          episode: download.episode,
          languages: subtitleLanguages,
          apiKey: wyzieApiKey,
        });
        if (subtitles.length > 0) {
          const hashPrefix = vaultName.replace(path.extname(vaultName), '');
          const saved = await downloadAndSaveSubtitles(subtitles, vaultDir, hashPrefix);
          if (saved.length > 0) {
            diag('completeWithRemux: subtitles saved', saved.map(s => s.file));
          }
        }
      } catch (subErr) {
        console.warn('[subtitles] error during subtitle download:', subErr.message);
      }
    }

    const mw = getMainWindow();
    if (mw && !mw.isDestroyed()) {
      mw.webContents.send('desk-download:progress', {
        ...update,
        status: 'completed',
        filePath: null,
        vaultPath: vaultName,
      });
    }
  } catch (e) {
    diag('completeWithRemux: failed', e.message);
    console.warn('[remux] completeWithRemux failed:', e.message);
    const mw = getMainWindow();
    if (mw && !mw.isDestroyed()) {
      mw.webContents.send('desk-download:progress', {
        ...update,
        status: 'error',
        lastMessage: 'Remux failed: ' + e.message,
        progress: update.progress,
      });
    }
  } finally {
    _remuxingDownloads.delete(downloadId);
    diag('completeWithRemux: finished');
  }
}

function updateDownloadEntry(id, entry) {
  downloadsStore.set(id, entry);
}

let _getMainWindow = null;
function getMainWindow() {
  return typeof _getMainWindow === 'function' ? _getMainWindow() : null;
}

// ── Vault management ──────────────────────────────────────────────────────────
function getVaultDir() {
  return path.join(app.getPath('userData'), 'vault');
}

function vaultFilename(downloadId, filePath) {
  const hash = crypto.createHash('md5').update(downloadId).digest('hex').slice(0, 16);
  const ext = filePath ? path.extname(filePath) : '.mp4';
  return `${hash}${ext}`;
}

function getStagingDir() {
  return path.join(app.getPath('userData'), 'staging');
}

function moveToVault(downloadId, sourcePath) {
  const vaultDir = getVaultDir();
  if (!fs.existsSync(vaultDir)) fs.mkdirSync(vaultDir, { recursive: true });
  const name = vaultFilename(downloadId, sourcePath);
  const dest = path.join(vaultDir, name);
  if (fs.existsSync(dest)) fs.unlinkSync(dest);
  try {
    fs.renameSync(sourcePath, dest);
  } catch (err) {
    if (err.code === 'EXDEV') {
      fs.copyFileSync(sourcePath, dest);
      fs.unlinkSync(sourcePath);
    } else throw err;
  }
  return name;
}

function getVaultPath(downloadId, filePath) {
  const name = vaultFilename(downloadId, filePath);
  return path.join(getVaultDir(), name);
}

function vaultFileExists(downloadId, filePath) {
  return fs.existsSync(getVaultPath(downloadId, filePath));
}

function removeFromVault(download) {
  if (!download?.vault_path) return;
  const fullPath = path.join(getVaultDir(), download.vault_path);
  try { if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath); } catch {}
}

function cleanupPlaybackVault() {
  const vaultDir = getVaultDir();
  if (!fs.existsSync(vaultDir)) return;
  for (const entry of fs.readdirSync(vaultDir, { withFileTypes: true })) {
    if (entry.isFile()) {
      try { fs.unlinkSync(path.join(vaultDir, entry.name)); } catch {}
    }
  }
}

// ── Export helpers ────────────────────────────────────────────────────────────
function getDownloadFilePath(download) {
  if (download.vault_path) {
    const vaultP = path.join(getVaultDir(), download.vault_path);
    if (fs.existsSync(vaultP)) return vaultP;
  }
  if (download.remux_path && fs.existsSync(download.remux_path)) return download.remux_path;
  if (download.file_path && fs.existsSync(download.file_path)) return download.file_path;
  return null;
}

function register(getMainWindowFn) {
  _getMainWindow = getMainWindowFn;
  setDiagCallback((msg) => {
    const mw = getMainWindow();
    if (mw && !mw.isDestroyed()) {
      mw.webContents.send('desk-download:diag', msg);
    }
  });

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
    season, episode, sourceId, binaryToken,
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

    const basePath = path.join(getStagingDir(), 'Nexube');
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
      sourceId, binaryToken, translationType, profileId, episodes,
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

    const basePath = path.join(getStagingDir(), 'Nexube');
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
        if (download.remux_path) {
          try { if (fs.existsSync(download.remux_path)) fs.unlinkSync(download.remux_path); } catch {}
          try {
            const dir = path.dirname(download.remux_path);
            if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
            const parent = path.dirname(dir);
            if (fs.existsSync(parent) && fs.readdirSync(parent).length === 0) fs.rmdirSync(parent);
          } catch {}
        }
        if (download.vault_path) {
          removeFromVault(download);
        } else {
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
      if (!download) {
        console.warn('[play] Download not found for id:', downloadId);
        return { success: false, error: 'Download not found' };
      }

      console.log('[play] Playing download:', { id: downloadId, vault_path: download.vault_path, remux_path: download.remux_path });

      // Primary: vault_path (hash-based, always set for new downloads)
      if (download.vault_path) {
        const vaultP = path.join(getVaultDir(), download.vault_path);
        console.log('[play] checking vault_path:', vaultP, 'exists:', fs.existsSync(vaultP));
        if (fs.existsSync(vaultP)) {
          const fileUrl = pathToFileURL(vaultP).toString();
          const result = { success: true, filePath: 'vault' + fileUrl.slice('file'.length) };

          // Find subtitles by hash prefix in vault dir
          const vaultDir = getVaultDir();
          const hashPrefix = download.vault_path.replace(path.extname(download.vault_path), '');
          try {
            const subs = fs.readdirSync(vaultDir).filter(f => f.startsWith(hashPrefix + '.') && f.endsWith('.vtt'));
            console.log('[play] VTT files found in vault:', subs.length, subs);
            if (subs.length > 0) {
              result.subtitles = subs.map(f => {
                const absPath = path.join(vaultDir, f);
                const subUrl = pathToFileURL(absPath).toString();
                const lang = f.replace(hashPrefix + '.', '').replace('.vtt', '');
                return {
                  lang,
                  file: 'vault' + subUrl.slice('file'.length),
                  label: getLanguageName(lang),
                };
              });
            }
          } catch (e) {
            console.warn('[play] Error reading vault subtitles:', e.message);
          }

          return result;
        }
        console.warn('[play] vault_path set but file does not exist:', vaultP);
      }

      // Fallback: legacy remux_path (organized dirs, pre-vault-refactor)
      if (download.remux_path && fs.existsSync(download.remux_path)) {
        const fileUrl = pathToFileURL(download.remux_path).toString();
        const result = { success: true, filePath: 'vault' + fileUrl.slice('file'.length) };
        console.log('[play] fallback remux_path found, exists');
        if (download.subtitles_path) {
          const subsDir = download.subtitles_path
            ? path.join(path.dirname(download.remux_path), download.subtitles_path)
            : path.dirname(download.remux_path);
          try {
            const subs = fs.readdirSync(subsDir).filter(f => f.endsWith('.vtt'));
            if (subs.length > 0) {
              result.subtitles = subs.map(f => {
                const absPath = path.join(subsDir, f);
                const subUrl = pathToFileURL(absPath).toString();
                return {
                  lang: f.replace('.vtt', ''),
                  file: 'vault' + subUrl.slice('file'.length),
                  label: getLanguageName(f.replace('.vtt', '')),
                };
              });
            }
          } catch (e) {
            console.warn('[play] Error reading subtitle dir:', e.message);
          }
        }
        return result;
      }

      console.warn('[play] File not found for download', downloadId, { vault_path: download.vault_path, remux_path: download.remux_path });
      return { success: false, error: 'File not found' };
    } catch (err) {
      console.warn('[play] Unexpected error:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('desk-download:play-external', async (_, downloadId) => {
    try {
      const download = getDownload(downloadId);
      if (!download) return { success: false, error: 'File not found' };

      const actualPath = getDownloadFilePath(download);
      if (!actualPath) return { success: false, error: 'File not found' };

      const isTv = download.season != null;
      let playlist = [];

      if (isTv) {
        const db = require('@nexube/store').getDatabase();
        const rows = db.prepare(
          `SELECT * FROM downloads WHERE media_id = ? AND season = ? AND status = 'completed' ORDER BY episode ASC`
        ).all(download.media_id, download.season);
        for (const r of rows) {
          const p = getDownloadFilePath(r);
          if (p) playlist.push({ ...r, resolvedPath: p });
        }
      } else if (download.collection_id) {
        const db = require('@nexube/store').getDatabase();
        const rows = db.prepare(
          `SELECT * FROM downloads WHERE collection_id = ? AND status = 'completed' ORDER BY media_id ASC`
        ).all(download.collection_id);
        for (const r of rows) {
          const p = getDownloadFilePath(r);
          if (p) playlist.push({ ...r, resolvedPath: p });
        }
      } else {
        playlist = [{ ...download, resolvedPath: actualPath }];
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
          vlcArgs.push(item.resolvedPath);
        }
        const child = spawn(vlcPath, vlcArgs, {
          detached: true,
          stdio: 'ignore',
        });
        child.unref();
      } else {
        player = 'default';
        shell.openPath(playlist[selectedIndex]?.resolvedPath || actualPath);
      }

      return { success: true, player, episodes: playlist.length };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('desk-download:export-single', async (_, downloadId) => {
    try {
      const download = getDownload(downloadId);
      if (!download) return { success: false, error: 'Download not found' };

      const sourcePath = getDownloadFilePath(download);
      if (!sourcePath) return { success: false, error: 'File not found' };

      const defaultName = download.episode_name
        ? `${download.title} - S${String(download.season || 1).padStart(2, '0')}E${String(download.episode || 1).padStart(2, '0')} - ${download.episode_name}${path.extname(sourcePath)}`
        : `${download.title}${path.extname(sourcePath)}`;

      const result = await dialog.showSaveDialog(null, {
        title: 'Export File',
        defaultPath: defaultName,
        filters: [{ name: 'Video Files', extensions: ['mp4', 'mkv', 'webm', 'mov', 'avi', 'm4v'] }],
      });
      if (result.canceled || !result.filePath) return { success: false, canceled: true };

      fs.copyFileSync(sourcePath, result.filePath);
      return { success: true, filePath: result.filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('desk-download:export-bulk', async (_, { downloadIds, destinationDir }) => {
    try {
      if (!destinationDir) {
        const result = await dialog.showOpenDialog(null, {
          title: 'Select Export Destination',
          properties: ['openDirectory', 'createDirectory'],
        });
        if (result.canceled || !result.filePaths[0]) return { success: false, canceled: true };
        destinationDir = result.filePaths[0];
      }

      let exported = 0;
      const errors = [];

      for (const id of downloadIds) {
        try {
          const download = getDownload(id);
          if (!download) { errors.push({ id, error: 'Not found' }); continue; }
          const sourcePath = getDownloadFilePath(download);
          if (!sourcePath) { errors.push({ id, error: 'File not found' }); continue; }

          const name = download.episode_name
            ? `${download.title} - S${String(download.season || 1).padStart(2, '0')}E${String(download.episode || 1).padStart(2, '0')} - ${download.episode_name}${path.extname(sourcePath)}`
            : `${download.title}${path.extname(sourcePath)}`;

          const sanitized = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
          let destPath = path.join(destinationDir, sanitized);
          let counter = 1;
          while (fs.existsSync(destPath)) {
            const ext = path.extname(sanitized);
            const base = path.basename(sanitized, ext);
            destPath = path.join(destinationDir, `${base} (${counter})${ext}`);
            counter++;
          }
          fs.copyFileSync(sourcePath, destPath);
          exported++;
        } catch (e) {
          errors.push({ id, error: e.message });
        }
      }

      return { success: true, exported, errors: errors.length > 0 ? errors : undefined };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('desk-download:get-vault-info', async (_, downloadId) => {
    try {
      const download = getDownload(downloadId);
      if (!download) return { success: false, error: 'Not found' };
      return {
        success: true,
        vaulted: !!download.vault_path,
        vaultPath: download.vault_path || null,
        filePath: download.file_path || null,
        size: download.size,
      };
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
        if (dl.vault_path) removeFromVault(dl);
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

  ipcMain.handle('desk-download:scan', async (_, { profileId, scanPath }) => {
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
    return path.join(getStagingDir(), 'Nexube');
  });

  ipcMain.handle('desk-download:show-in-folder', (_, downloadId) => {
    const download = getDownload(downloadId);
    if (!download) return;
    if (download.vault_path) {
      const vaultP = path.join(getVaultDir(), download.vault_path);
      if (fs.existsSync(vaultP)) shell.showItemInFolder(vaultP);
      return;
    }
    if (download.remux_path && fs.existsSync(download.remux_path)) {
      shell.showItemInFolder(download.remux_path);
      return;
    }
    const target = download.file_path || download.download_path;
    if (target && fs.existsSync(target)) shell.showItemInFolder(target);
  });

  // ── Vault-first migration ───────────────────────────────────────────────────
  // 1. Move legacy staging files into vault (hash-based)
  try {
    const db = require('@nexube/store').getDatabase();
    const legacy = db.prepare(
      `SELECT id, file_path FROM downloads WHERE status = 'completed' AND file_path IS NOT NULL AND vault_path IS NULL`
    ).all();
    for (const row of legacy) {
      if (!row.file_path || !fs.existsSync(row.file_path)) continue;
      const name = moveToVault(row.id, row.file_path);
      updateDownload(row.id, { vaultPath: name, filePath: null });
    }
  } catch {}

  // 2. Backfill: move existing organized (remux_path) files into vault
  try {
    const db = require('@nexube/store').getDatabase();
    const organized = db.prepare(
      `SELECT id, remux_path FROM downloads WHERE status = 'completed' AND remux_path IS NOT NULL AND vault_path IS NULL`
    ).all();
    const vaultDir = getVaultDir();
    for (const row of organized) {
      if (!row.remux_path || !fs.existsSync(row.remux_path)) continue;
      try {
        const name = moveToVault(row.id, row.remux_path);
        updateDownload(row.id, { vaultPath: name, remuxPath: null, filePath: null });
        // Move subtitle files from organized dir to vault
        const remuxDir = path.dirname(row.remux_path);
        if (fs.existsSync(remuxDir)) {
          const hashPrefix = name.replace(path.extname(name), '');
          for (const f of fs.readdirSync(remuxDir)) {
            if (f.endsWith('.vtt')) {
              const src = path.join(remuxDir, f);
              const dest = path.join(vaultDir, `${hashPrefix}.${f}`);
              try { fs.copyFileSync(src, dest); } catch {}
            }
          }
          try { fs.rmSync(remuxDir, { recursive: true, force: true }); } catch {}
        }
      } catch (e) {
        console.warn('[migration] failed to move organized file to vault:', e.message);
      }
    }
  } catch {}

  // Cleanup stale staging files
  try {
    const stagingDir = getStagingDir();
    if (fs.existsSync(stagingDir)) {
      for (const entry of fs.readdirSync(stagingDir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          try { fs.rmSync(path.join(stagingDir, entry.name), { recursive: true, force: true }); } catch {}
        }
      }
    }
  } catch {}

  _processDownloadQueue();
}

module.exports = { register, killAllDownloads };
