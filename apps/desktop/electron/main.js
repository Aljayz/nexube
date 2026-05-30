const { app, BrowserWindow, session, ipcMain, shell, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');

const { getDatabase, closeDatabase } = require('@nexube/store');
const APP_VERSION = require('../package.json').version;

const BLOCKED_HOSTS = [
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
];

app.setName('Nexube');
app.setAppUserModelId('com.nexube.app');
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

let mainWindow = null;

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
      webSecurity: true,
      webviewTag: true,
    },
    show: false,
  });

  const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://image.tmdb.org https://img.youtube.com; media-src 'self' blob: https: file: local-media: media:; connect-src 'self' https://api.themoviedb.org https://api.themoviedb.org/3 https://nexube-feedback-api.vercel.app; frame-src https:;";
  const CSP_EXEMPT_DOMAINS = ['vaplayer.ru'];
  session.defaultSession.webRequest.onHeadersReceived({ urls: ['*://*/*'] }, (details, callback) => {
    const headers = { ...details.responseHeaders };
    const shouldInjectCSP = !CSP_EXEMPT_DOMAINS.some((d) => details.url.includes(d));
    if (shouldInjectCSP) {
      headers['content-security-policy'] = [CSP];
    }
    callback({ responseHeaders: headers });
  });

  blockStats.init(getMainWindow);

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

  trailerSession.webRequest.onBeforeRequest({ urls: BLOCKED_HOSTS }, (_, cb) => cb({ cancel: true }));

  const MEDIA_URLS = ['*://*/*.m3u8*', '*://*/*.m3u8', '*://*/*.vtt*', '*://*/*.vtt'];
  playerSession.webRequest.onBeforeRequest(
    { urls: [...BLOCKED_HOSTS, ...MEDIA_URLS] },
    (details, callback) => {
      const { url } = details;
      const isMedia = url.includes('.m3u8') || url.includes('.vtt');
      if (!isMedia) {
        blockStats.recordBlockedRequest(url);
        callback({ cancel: true });
        return;
      }
      try {
        const parsed = new URL(url);
        const host = parsed.hostname;
        const path = parsed.pathname;
        const blocked = BLOCKED_HOSTS.some((pat) => {
          const withoutScheme = pat.replace(/^\*:\/\//, '');
          const slashIdx = withoutScheme.indexOf('/');
          const patHost = slashIdx === -1 ? withoutScheme : withoutScheme.substring(0, slashIdx);
          const patPath = slashIdx === -1 ? '' : withoutScheme.substring(slashIdx);
          const hostMatch = patHost.startsWith('*.')
            ? host === patHost.slice(2) || host.endsWith('.' + patHost.slice(2))
            : host === patHost;
          if (!hostMatch) return false;
          if (patPath) {
            const escaped = patPath.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
            return new RegExp('^' + escaped + '$').test(path);
          }
          return true;
        });
        if (blocked) {
          blockStats.recordBlockedRequest(url);
          callback({ cancel: true });
          return;
        }
      } catch {}
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (url.includes('.m3u8')) {
          mainWindow.webContents.send('m3u8-found', url);
        } else if (url.includes('.vtt')) {
          const langMatch = url.match(/\/(\w{2})\.vtt/) || url.match(/[?&]lang=(\w{2})/);
          mainWindow.webContents.send('subtitle-found', { url, lang: langMatch ? langMatch[1] : 'en' });
        }
      }
      callback({});
    }
  );

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
  { scheme: 'local-media', privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: true, corsEnabled: true, stream: true } },
  { scheme: 'media', privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: true, corsEnabled: true, stream: true } },
]);

app.whenReady().then(() => {
  getDatabase(path.join(app.getPath('userData'), 'nexube.db'));
  blockStats.loadBlockStats();

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

  ipcMain.handle('get-block-stats', () => blockStats.getBlockStats());
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

  protocol.handle('media', async (request) => {
    try {
      const parsed = new URL(request.url);
      let filePath = decodeURIComponent(parsed.hostname ? '/' + parsed.hostname + parsed.pathname : parsed.pathname);
      if (process.platform === 'win32' && /^\/[A-Za-z]:/.test(filePath)) {
        filePath = filePath.slice(1);
      }
      console.log(`[media] serving file: ${filePath}`);
      const stat = await fs.promises.stat(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.mp4': 'video/mp4', '.mkv': 'video/x-matroska', '.webm': 'video/webm',
        '.mov': 'video/quicktime', '.avi': 'video/x-msvideo', '.m4v': 'video/mp4',
      };
      const contentType = mimeTypes[ext] || 'video/mp4';
      const fileSize = stat.size;
      const rangeHeader = request.headers.get('Range');

      if (rangeHeader) {
        const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
        if (match) {
          const start = parseInt(match[1], 10);
          const end = match[2] ? Math.min(parseInt(match[2], 10), fileSize - 1) : fileSize - 1;
          return new Response(Readable.toWeb(fs.createReadStream(filePath, { start, end })), {
            status: 206,
            headers: {
              'Content-Type': contentType,
              'Content-Range': `bytes ${start}-${end}/${fileSize}`,
              'Content-Length': String(end - start + 1),
              'Accept-Ranges': 'bytes',
              'Access-Control-Allow-Origin': '*',
            },
          });
        }
      }

      return new Response(Readable.toWeb(fs.createReadStream(filePath)), {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(fileSize),
          'Accept-Ranges': 'bytes',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (err) {
      console.error(`[media] Failed to serve ${request.url}:`, err);
      return new Response(String(err), { status: 500 });
    }
  });

  protocol.handle('local-media', async (request) => {
    try {
      const parsed = new URL(request.url);
      let filePath = decodeURIComponent(parsed.hostname ? '/' + parsed.hostname + parsed.pathname : parsed.pathname);
      if (process.platform === 'win32' && /^\/[A-Za-z]:/.test(filePath)) {
        filePath = filePath.slice(1);
      }

      const stat = await fs.promises.stat(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.mp4': 'video/mp4', '.mkv': 'video/x-matroska', '.webm': 'video/webm',
        '.mov': 'video/quicktime', '.avi': 'video/x-msvideo', '.m4v': 'video/mp4',
      };
      const contentType = mimeTypes[ext] || 'video/mp4';
      const fileSize = stat.size;
      const rangeHeader = request.headers.get('Range');

      if (rangeHeader) {
        const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
        if (match) {
          const start = parseInt(match[1], 10);
          const end = match[2] ? Math.min(parseInt(match[2], 10), fileSize - 1) : fileSize - 1;
          return new Response(Readable.toWeb(fs.createReadStream(filePath, { start, end })), {
            status: 206,
            headers: {
              'Content-Type': contentType,
              'Content-Range': `bytes ${start}-${end}/${fileSize}`,
              'Content-Length': String(end - start + 1),
              'Accept-Ranges': 'bytes',
              'Access-Control-Allow-Origin': '*',
            },
          });
        }
      }

      return new Response(Readable.toWeb(fs.createReadStream(filePath)), {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(fileSize),
          'Accept-Ranges': 'bytes',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (err) {
      console.error(`[local-media] Failed to serve ${request.url}:`, err);
      return new Response(String(err), { status: 404 });
    }
  });

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
