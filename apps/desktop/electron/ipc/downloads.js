const { ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const {
  addDownload,
  updateDownload,
  getDownloads,
  getDownload,
  deleteDownload,
  getActiveDownloads,
} = require('@nexube/store');
const { captureM3u8Url } = require('../services/hls-capture');
const {
  checkDownloader,
  runDownload,
  stopDownload,
  killAllDownloads,
  getBundledBinaryPath,
  cleanupPartialFiles,
  resolveBinaryPath,
  checkBundledAndRegister,
} = require('../services/downloader');

const downloadsStore = new Map();

function sendProgress(update) {
  const mw = getMainWindow();
  if (mw && !mw.isDestroyed()) {
    mw.webContents.send('download:progress', update);
  }
}

function updateDownloadEntry(id, entry) {
  downloadsStore.set(id, entry);
}

let _mainWindow = null;
function getMainWindow() {
  return _mainWindow;
}

function register(mainWindow) {
  _mainWindow = mainWindow;

  ipcMain.handle('check-bundled-downloader', () => {
    return checkBundledAndRegister();
  });

  ipcMain.handle('check-downloader', (_, folderPath) => {
    return checkDownloader(folderPath);
  });

  ipcMain.handle('run-download', async (_, {
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
    subtitles,
    sourceId,
  }) => {
    try {
      const binaryPath = resolveBinaryPath(binaryToken);
      if (!binaryPath) {
        return { ok: false, error: 'Downloader binary not found or token expired' };
      }

      const downloadId = `dl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      addDownload({
        id: downloadId,
        profileId: mediaId,
        mediaId: `${mediaType}-${tmdbId}`,
        quality: 'best',
        m3u8Url,
        season,
        episode,
        sourceId,
      });

      updateDownload(downloadId, {
        status: 'downloading',
        startedAt: new Date().toISOString(),
      });

      const result = runDownload({
        binaryPath: checkResult.binaryPath,
        m3u8Url,
        name,
        downloadPath,
        mediaId,
        mediaType,
        season,
        episode,
        posterPath,
        tmdbId,
        subtitles,
        downloadId,
      }, sendProgress, () => Array.from(downloadsStore.values()), updateDownloadEntry);

      if (result.ok) {
        return { ok: true, id: result.id, downloadId };
      }
      return result;
    } catch (err) {
      return { ok: false, error: err.message || 'Failed to start download' };
    }
  });

  ipcMain.handle('downloads:start', async (_, {
    profileId,
    mediaId,
    title,
    type,
    quality,
    tmdbId,
    season,
    episode,
    sourceId,
    binaryToken,
    downloadPath,
    episodeTitle,
  }) => {
    try {
      console.log('[downloads:start] params:', { mediaId, type, tmdbId, season, episode, sourceId, downloadPath });

      let resolvedBinaryPath = null;

      if (binaryToken) {
        resolvedBinaryPath = resolveBinaryPath(binaryToken);
      }

      if (!resolvedBinaryPath) {
        const bundledResult = checkBundledAndRegister();
        if (!bundledResult.exists) {
          return { success: false, error: 'No downloader binary found. Please set it up in the download modal.' };
        }
        resolvedBinaryPath = resolveBinaryPath(bundledResult.token);
      }

      const basePath = path.join(downloadPath || path.join(require('os').homedir(), 'Downloads'), 'Nexube');
      const sanitizedTitle = title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim() || 'Unknown';

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

      console.log('[downloads:start] existing:', existing ? existing.id : 'none');

      if (existing) {
        if (existing.status === 'downloading') {
          return { success: false, error: 'Already downloading' };
        }

        const { isDownloadActive } = require('../services/downloader');
        if (isDownloadActive(existing.id)) {
          return { success: false, error: 'Download already in progress' };
        }

        const { getSourceById } = require('../services/sources');
        const source = getSourceById(sourceId || existing.source_id || 'videasy');
        if (!source) {
          return { success: false, error: 'Invalid source' };
        }

        const playerUrl = typeof source.url === 'function'
          ? await source.url(type, tmdbId, season || 1, episode || 1)
          : source.url;

        const captured = await captureM3u8Url(playerUrl);

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
          captured.m3u8Url, captured.referer, JSON.stringify(captured.cookies), fileDir, quality || 'best', source.id, episodeTitle || null, existing.id
        );

      const result = runDownload({
        binaryPath,
          m3u8Url: captured.m3u8Url,
          name: safeName,
          downloadPath: fileDir,
          mediaId,
          mediaType: type,
          season,
          episode,
          posterPath: null,
          tmdbId,
          subtitles: [],
          downloadId: existing.id,
          initialProgress: existing.progress_percent || 0,
        }, sendProgress, () => Array.from(downloadsStore.values()), updateDownloadEntry, updateDownload);

        if (result.ok) {
          return { success: true, downloadId: existing.id, id: result.id };
        }
        return { success: false, error: result.error };
      }

      const downloadId = `dl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      console.log('[downloads:start] new download, id:', downloadId);

      const { getSourceById } = require('../services/sources');
      const source = getSourceById(sourceId || 'videasy');
      if (!source) {
        return { success: false, error: 'Invalid source' };
      }

      const playerUrl = typeof source.url === 'function'
        ? await source.url(type, tmdbId, season || 1, episode || 1)
        : source.url;

      const captured = await captureM3u8Url(playerUrl);

      fs.mkdirSync(fileDir, { recursive: true });

      addDownload({
        id: downloadId,
        profileId,
        mediaId,
        quality,
        m3u8Url: captured.m3u8Url,
        referer: captured.referer,
        cookies: JSON.stringify(captured.cookies),
        downloadPath: fileDir,
        season,
        episode,
        episodeName: episodeTitle,
        sourceId: source.id,
      });

      const result = runDownload({
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
        subtitles: [],
        downloadId,
      }, sendProgress, () => Array.from(downloadsStore.values()), updateDownloadEntry, updateDownload);

      if (result.ok) {
        updateDownload(downloadId, {
          status: 'downloading',
          startedAt: new Date().toISOString(),
          processId: null,
        });
        return { success: true, downloadId, id: result.id };
      }
      return { success: false, error: result.error };
    } catch (err) {
      return { success: false, error: err.message || 'Failed to start download' };
    }
  });

  ipcMain.handle('downloads:cancel', async (_, downloadId) => {
    try {
      const download = getDownload(downloadId);
      if (download && download.download_path && download.title) {
        const safeName = download.type === 'tv'
          ? `${download.title} - S${String(download.season || 1).padStart(2, '0')}E${String(download.episode || 1).padStart(2, '0')}${download.episode_name ? ` - ${download.episode_name}` : ''}`
          : `${download.title}`;
        cleanupPartialFiles({
          filePath: download.file_path,
          downloadPath: download.download_path,
          name: safeName,
        });
      }
      stopDownload(downloadId);
      updateDownload(downloadId, { status: 'cancelled', error: 'Stopped by user', processId: null, completedAt: new Date().toISOString() });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('downloads:delete', async (_, downloadId) => {
    try {
      stopDownload(downloadId);
      const download = getDownload(downloadId);
      if (download) {
        const safeName = download.type === 'tv'
          ? `${download.title} - S${String(download.season || 1).padStart(2, '0')}E${String(download.episode || 1).padStart(2, '0')}${download.episode_name ? ` - ${download.episode_name}` : ''}`
          : `${download.title}`;
        cleanupPartialFiles({
          filePath: download.file_path,
          downloadPath: download.download_path,
          name: safeName,
        });
      }
      deleteDownload(downloadId);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('downloads:list', async (_, profileId) => {
    try {
      return getDownloads(profileId);
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('downloads:getActive', async (_, profileId) => {
    try {
      return getActiveDownloads(profileId);
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('downloads:play', async (_, downloadId) => {
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

  ipcMain.handle('downloads:kill-all', async () => {
    try {
      const db = require('@nexube/store').getDatabase();
      const active = db.prepare(
        `SELECT d.id, d.file_path, d.download_path, d.season, d.episode, d.episode_name, gm.title, gm.type
         FROM downloads d
         INNER JOIN global_media gm ON d.media_id = gm.id
         WHERE d.status = 'downloading'`
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
          });
        }
        stopDownload(dl.id);
        updateDownload(dl.id, { status: 'cancelled', error: 'Stopped by user', processId: null, completedAt: new Date().toISOString() });
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('pick-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Downloader Folder',
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('pick-download-path', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Download Folder',
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('show-in-folder', (_, filePath) => {
    if (filePath && fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
    }
  });

  ipcMain.handle('open-path', (_, filePath) => {
    try {
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        shell.openPath(filePath);
      } else {
        shell.showItemInFolder(filePath);
      }
    } catch {
      shell.openPath(filePath);
    }
  });
}

module.exports = { register, killAllDownloads };
