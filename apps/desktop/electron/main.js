const { app, BrowserWindow, session, ipcMain, nativeImage, shell } = require('electron');
const path = require('path');
const { getDatabase, closeDatabase } = require('@nexube/store');

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
const { register: registerDownloads, killAllDownloads } = require('./ipc/downloads');

let mainWindow = null;

function getMainWindow() {
  return mainWindow;
}

function createWindow() {
  const iconPath = path.join(__dirname, '../public/Logo.png');
  const icon = nativeImage.createFromPath(iconPath);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    frame: process.platform === 'darwin',
    backgroundColor: '#08080C',
    icon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      webviewTag: true,
    },
    show: false,
  });

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`
      const meta = document.createElement('meta');
      meta.httpEquiv = 'Content-Security-Policy';
      meta.content = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://image.tmdb.org https://img.youtube.com; media-src 'self' blob: https: file:; connect-src 'self' https://api.themoviedb.org https://api.themoviedb.org/3; frame-src https:;";
      document.head.appendChild(meta);
    `).catch(() => {});
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
        const host = new URL(url).hostname;
        const blocked = BLOCKED_HOSTS.some((pat) => {
          const hostPat = pat.replace(/^\*:\/\//, '').split('/')[0];
          return hostPat.startsWith('*.')
            ? host.endsWith(hostPat.slice(1))
            : host === hostPat || host === hostPat.replace(/^\*\./, '');
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

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.commandLine.appendSwitch('max-old-space-size', '256');
app.commandLine.appendSwitch('renderer-process-limit', '3');
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling,InsecureCSPWarning');
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('in-process-gpu');

app.whenReady().then(() => {
  getDatabase();
  blockStats.loadBlockStats();

  registerStorage();
  registerPlayer(getMainWindow);
  registerWindow(getMainWindow);
  registerTmdb();
  registerProfiles();
  registerLibrary();
  registerSystem();
  registerDownloads(mainWindow);
  registerAllmanga();

  ipcMain.handle('get-block-stats', () => blockStats.getBlockStats());
  ipcMain.handle('get-platform', () => process.platform);
  ipcMain.handle('record-blocked-popup', (_, url) => {
    blockStats.recordBlockedRequest(url);
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

  createWindow();

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
  killAllDownloads();
  closeDatabase();
  if (mainWindow) {
    mainWindow.webContents.send('app-quitting');
  }
});
