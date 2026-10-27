const { app, BrowserWindow, session, ipcMain, shell, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');
const { getDatabase, closeDatabase } = require('@nexube/store');

const MIME_TYPES = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
  '.m4v': 'video/mp4',
  '.ts': 'video/mp2t',
  '.ogg': 'video/ogg',
  '.ogv': 'video/ogg',
  '.vtt': 'text/vtt',
  '.srt': 'text/plain',
};

app.setName('Nexube');
app.setAppUserModelId('com.nexube.app');

// Dev runs can overlap with an installed Nexube instance. Give Chromium its own
// session/cache directory so the two processes don't fight over the same files.
// userData is intentionally left shared so dev keeps the existing profile and
// settings; only cookies/cache/localStorage are isolated.
if (process.env.VITE_DEV_SERVER_URL) {
  app.setPath('sessionData', path.join(app.getPath('temp'), 'nexube-dev-session'));
}

app.disableHardwareAcceleration();
const { register: registerStorage } = require('./ipc/storage');
const { register: registerPlayer } = require('./ipc/player');
const blockStats = require('./ipc/blockStats');
const { register: registerAllmanga } = require('./ipc/allmanga');
const { register: registerWindow } = require('./ipc/window');
const { register: registerTmdb } = require('./ipc/tmdb');
const { register: registerProfiles } = require('./ipc/profiles');
const { register: registerLibrary } = require('./ipc/library');
const { register: registerSystem } = require('./ipc/system');
const { register: registerDeskDownloads, killAllDownloads: killAllDeskDownloads } = require('./ipc/desk-downloads');
const { register: registerUpdater } = require('./ipc/updater');
const { register: registerWyzie } = require('./ipc/wyzie');
const adblocker = require('./services/adblocker');

let mainWindow = null;
let mediaObserverRegistered = false;

function getMainWindow() {
  return mainWindow;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    frame: process.platform === 'darwin',
    backgroundColor: '#08080C',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: !process.env.VITE_DEV_SERVER_URL,
      webviewTag: true,
    },
    show: false,
  });

  const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://image.tmdb.org https://img.youtube.com; media-src 'self' blob: https: file: vault:; connect-src 'self' vault: https://api.themoviedb.org https://api.themoviedb.org/3 https://nexube-feedback-api.vercel.app; frame-src https:;";
  const CSP_EXEMPT_DOMAINS = ['vaplayer.ru'];
  session.defaultSession.webRequest.onHeadersReceived({ urls: ['*://*/*'] }, (details, callback) => {
    const headers = { ...details.responseHeaders };
    const shouldInjectCSP = !CSP_EXEMPT_DOMAINS.some((d) => details.url.includes(d));
    if (shouldInjectCSP) {
      headers['content-security-policy'] = [CSP];
    }
    callback({ responseHeaders: headers });
  });

  const playerSession = session.fromPartition('persist:player');
  const trailerSession = session.fromPartition('persist:trailer');

  const stripHeaders = (details, callback) => {
    const headers = { ...details.responseHeaders };
    delete headers['content-security-policy'];
    delete headers['x-frame-options'];
    callback({ responseHeaders: headers });
  };

  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  playerSession.setUserAgent(UA);
  trailerSession.setUserAgent(UA);

  playerSession.webRequest.onHeadersReceived({ urls: ['*://*/*'] }, stripHeaders);
  trailerSession.webRequest.onHeadersReceived({ urls: ['*://*/*'] }, stripHeaders);

  if (!mediaObserverRegistered) {
    mediaObserverRegistered = true;
    // One shared onBeforeRequest listener is owned by services/adblocker.js.
    // This observer only reports media URLs after ad blocking has allowed them.
    adblocker.addRequestObserver(playerSession, (details) => {
      if (!mainWindow || mainWindow.isDestroyed()) return null;
      const { url } = details;
      if (url.includes('.m3u8')) {
        mainWindow.webContents.send('m3u8-found', url);
      } else if (url.includes('.vtt')) {
        const langMatch = url.match(/\/(\w{2})\.vtt/) || url.match(/[?&]lang=(\w{2})/);
        mainWindow.webContents.send('subtitle-found', {
          url,
          lang: langMatch ? langMatch[1] : 'en',
        });
      }
      return null;
    });
  }

  const ytCookie = {
    url: 'https://www.youtube.com',
    name: 'SOCS',
    value: 'CAI',
    path: '/',
    secure: true,
    httpOnly: false,
    sameSite: 'no_restriction',
    expirationDate: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365 * 2,
  };
  for (const domain of ['.youtube.com', '.youtube-nocookie.com']) {
    playerSession.cookies.set({ ...ytCookie, domain }).catch(() => {});
    trailerSession.cookies.set({ ...ytCookie, domain }).catch(() => {});
  }

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
    console.error(`[MAIN] Failed to load page: ${errorDescription} (${errorCode})`);
  });

  mainWindow.webContents.on('crashed', () => {
    console.error('[MAIN] Renderer process crashed');
  });

  mainWindow.webContents.on('did-attach-webview', (_, wc) => {
    wc.on('enter-html-full-screen', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('webview-enter-fullscreen');
      }
    });
    wc.on('leave-html-full-screen', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('webview-leave-fullscreen');
      }
    });
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

if (process.platform !== 'darwin') {
  app.commandLine.appendSwitch('no-sandbox');
}
app.commandLine.appendSwitch('max-old-space-size', '256');
app.commandLine.appendSwitch('renderer-process-limit', '3');
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling,InsecureCSPWarning');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'vault',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

app.whenReady().then(() => {
  getDatabase(path.join(app.getPath('userData'), 'nexube.db'));
  blockStats.init(getMainWindow);
  blockStats.loadBlockStats();

  // Attach the Brave adblock engine before any window/player session starts
  // loading. Engine parsing happens asynchronously; the legacy fallback list is
  // active immediately while the serialized engine or filter lists load.
  adblocker.init();

  registerStorage();
  registerPlayer(getMainWindow);
  registerWindow(getMainWindow);
  registerTmdb();
  registerProfiles();
  registerLibrary();
  registerSystem();
  registerDeskDownloads(getMainWindow);
  registerAllmanga();
  registerUpdater();
  registerWyzie();

  ipcMain.handle('get-block-stats', () => blockStats.getBlockStats());
  ipcMain.handle('adblock:get-status', () => adblocker.getStatus());
  ipcMain.handle('adblock:refresh', async () => {
    await adblocker.refreshNow();
    return adblocker.getStatus();
  });
  ipcMain.handle('get-platform', () => process.platform);
  ipcMain.handle('get-app-version', () => APP_VERSION);
  ipcMain.handle('record-blocked-popup', (_, url) => {
      blockStats.recordBlockedRequest(url);
    });
   
    ipcMain.handle('feedback:openForm', async () => {
      return { success: true, version: APP_VERSION };
    });

  try {
      const { getDatabase, deleteDownload } = require('@nexube/store');
      const db = getDatabase();
      const orphaned = db.prepare("SELECT id FROM downloads WHERE status = 'downloading'").all();
      for (const row of orphaned) {
        deleteDownload(row.id);
      }
    } catch {}

    ipcMain.handle('shell:openPath', async (_, filePath) => {
    return shell.openPath(filePath);
  });

  ipcMain.handle('shell:showItemInFolder', async (_, filePath) => {
    shell.showItemInFolder(filePath);
    return true;
  });

  ipcMain.handle('shell:openExternal', async (_, url) => {
    return shell.openExternal(url);
  });

  ipcMain.handle('desk-download:read-log', async (_, logPath) => {
    try {
      const content = fs.readFileSync(logPath, 'utf8');
      return { success: true, content };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  protocol.handle('vault', async (request) => {
    try {
      const vaultUrl = new URL(request.url);
      let filePath = decodeURIComponent(vaultUrl.pathname);
      // When Chromium normalizes vault:///absolute/path to vault://host/path,
      // the first path component ends up as the hostname (e.g. vault://home/aljay/...
      // → hostname="home", pathname="/aljay/..."). Reconstruct the absolute path.
      // On Windows, a single-letter hostname is a drive letter (vault://c/Users/...
      // → hostname="c", pathname="/Users/...") → prepend "C:".
      if (vaultUrl.hostname) {
        if (process.platform === 'win32' && /^[a-zA-Z]$/.test(vaultUrl.hostname)) {
          filePath = `${vaultUrl.hostname.toUpperCase()}:${filePath}`;
        } else {
          filePath = `/${vaultUrl.hostname}${filePath}`;
        }
        // Strip leading / before drive letter (e.g. /C:/ → C:/)
        filePath = filePath.replace(/^\/([a-zA-Z]:)/, '$1');
      }
      if (!fs.existsSync(filePath)) {
        return new Response('Not found', { status: 404 });
      }
      const stat = fs.statSync(filePath);
      const mimeType = MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
      const range = request.headers.get('Range');
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        const stream = fs.createReadStream(filePath, { start, end });
        return new Response(Readable.toWeb(stream), {
          status: 206,
          headers: {
            'Content-Type': mimeType,
            'Content-Range': `bytes ${start}-${end}/${stat.size}`,
            'Content-Length': (end - start + 1).toString(),
            'Accept-Ranges': 'bytes',
          },
        });
      }
      const stream = fs.createReadStream(filePath);
      return new Response(Readable.toWeb(stream), {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Length': stat.size.toString(),
          'Accept-Ranges': 'bytes',
        },
      });
    } catch (err) {
      return new Response(err.message, { status: 500 });
    }
  });

  createWindow();

  setTimeout(() => {
    const Store = require('./lib/store');
    const updaterStore = new Store({ name: 'updater-settings' });

    if (!updaterStore.get('previousVersion', '')) {
      updaterStore.set('previousVersion', APP_VERSION);
    }

    if (updaterStore.get('autoUpdaterEnabled', true)) {
      const { autoUpdater } = require('electron-updater');
      autoUpdater.checkForUpdates().catch(() => {});
    }
  }, 5000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  killAllDeskDownloads();
  closeDatabase();
  if (mainWindow) {
    mainWindow.webContents.send('app-quitting');
  }
});
