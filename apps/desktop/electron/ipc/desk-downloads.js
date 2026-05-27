const { ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
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

  ipcMain.handle('desk-download:queue', async (_, {
    profileId,
    mediaId,
    title,
    type,
    formatSpec,
    tmdbId,
    season,
    episode,
    sourceId,
    binaryToken,
    downloadPath,
    episodeTitle,
    translationType,
  }) => {
    try {
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
          return { success: false, error: 'Already downloading' };
        }
        if (isDownloadActive(existing.id)) {
          return { success: false, error: 'Download already in progress' };
        }

        const { getSourceById } = require('../services/sources');
        const source = getSourceById(sourceId || 'videasy');
        if (!source) {
          return { success: false, error: 'Invalid source' };
        }

        let captured;

        if (sourceId === 'allmanga') {
          console.log(`[desk-downloads] Using AllManga resolver for title="${title}" season=${season || 1} ep=${episode || 1} (existing download)`);
          const allmangaResult = await resolveAllmanga({
            title,
            seasonNumber: season || 1,
            episodeNumber: episode || 1,
            isMovie: type === 'movie',
            translationType: translationType || 'sub',
          });
          if (allmangaResult?.ok) {
            console.log(`[desk-downloads] AllManga resolver OK: url=${allmangaResult.url?.slice(0, 150)} isDirectMp4=${allmangaResult.isDirectMp4}`);
            captured = { m3u8Url: allmangaResult.url, referer: allmangaResult.referer || 'https://allmanga.to', cookies: '' };
          } else {
            console.log(`[desk-downloads] AllManga resolver FAILED: ${allmangaResult?.error}`);
            captured = null;
          }
        } else {
          const playerUrl = typeof source.url === 'function'
            ? await source.url(type, tmdbId, season || 1, episode || 1)
            : source.url;

          console.log(`[desk-downloads] Calling captureM3u8Url for source=${sourceId} playerUrl=${playerUrl} (existing download)`);

          const captureOpts = sourceId === 'vidsrc' ? { visible: true, autoPlay: false } : {};
          captured = await captureM3u8Url(playerUrl, 120000, captureOpts);

          console.log(`[desk-downloads] captureM3u8Url RESULT for ${sourceId}: m3u8Url=${captured?.m3u8Url?.slice(0, 150) || 'NONE'} referer=${captured?.referer?.slice(0, 100)}`);
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
        console.log(`[desk-downloads] Using AllManga resolver for title="${title}" season=${season || 1} ep=${episode || 1} (new download)`);
        const allmangaResult = await resolveAllmanga({
          title,
          seasonNumber: season || 1,
          episodeNumber: episode || 1,
          isMovie: type === 'movie',
          translationType: translationType || 'sub',
        });
        if (allmangaResult?.ok) {
          console.log(`[desk-downloads] AllManga resolver OK: url=${allmangaResult.url?.slice(0, 150)} isDirectMp4=${allmangaResult.isDirectMp4}`);
          captured = { m3u8Url: allmangaResult.url, referer: allmangaResult.referer || 'https://allmanga.to', cookies: '' };
        } else {
          console.log(`[desk-downloads] AllManga resolver FAILED: ${allmangaResult?.error}`);
          captured = null;
        }
      } else {
        const playerUrl = typeof source.url === 'function'
          ? await source.url(type, tmdbId, season || 1, episode || 1)
          : source.url;

        console.log(`[desk-downloads] Calling captureM3u8Url for source=${sourceId} playerUrl=${playerUrl} (new download)`);

        const captureOpts = sourceId === 'vidsrc' ? { visible: true, autoPlay: false } : {};
        captured = await captureM3u8Url(playerUrl, 120000, captureOpts);

        console.log(`[desk-downloads] captureM3u8Url RESULT for ${sourceId}: m3u8Url=${captured?.m3u8Url?.slice(0, 150) || 'NONE'} referer=${captured?.referer?.slice(0, 100)}`);
      }

      if (!captured) {
        return { success: false, error: 'Failed to capture video URL' };
      }

      fs.mkdirSync(fileDir, { recursive: true });

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
    } catch (err) {
      return { success: false, error: err.message || 'Failed to queue download' };
    }
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
      return { success: true, filePath: download.file_path };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

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
      title: 'Select Desk Downloader Folder',
    };
    if (defaultPath && fs.existsSync(defaultPath)) {
      opts.defaultPath = defaultPath;
    }
    const result = await dialog.showOpenDialog(mainWindow, opts);
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('desk-download:show-in-folder', (_, filePath) => {
    if (filePath && fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
    }
  });
}

module.exports = { register, killAllDownloads };
