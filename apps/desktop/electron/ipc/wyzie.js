const { ipcMain, BrowserWindow, session } = require('electron');

function register() {
  ipcMain.handle('wyzie:open-redeem', async () => {
    return new Promise((resolve) => {
      const redeemSession = session.fromPartition('partition:wyzie-redeem');

      redeemSession.webRequest.onHeadersReceived((details, callback) => {
        const headers = { ...details.responseHeaders };
        delete headers['content-security-policy'];
        delete headers['Content-Security-Policy'];
        callback({ responseHeaders: headers });
      });

      const win = new BrowserWindow({
        width: 960,
        height: 720,
        title: 'Claim your Wyzie API Key',
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          session: redeemSession,
        },
        backgroundColor: '#ffffff',
        autoHideMenuBar: true,
      });

      let resolved = false;

      const finish = (result) => {
        if (resolved) return;
        resolved = true;
        if (!win.isDestroyed()) win.close();
        resolve(result);
      };

      win.on('closed', () => {
        if (!resolved) resolve({ ok: false, key: null, cancelled: true });
      });

      const checkUrl = (url) => {
        try {
          const u = new URL(url);
          if (u.hostname === 'sub.wyzie.io' && u.pathname === '/notice') {
            const key = u.searchParams.get('key');
            if (key && key.startsWith('wyzie-') && key.length > 10) {
              finish({ ok: true, key });
              return true;
            }
          }
        } catch {}
        return false;
      };

      win.webContents.on('will-navigate', (_, url) => checkUrl(url));
      win.webContents.on('did-navigate', (_, url) => checkUrl(url));
      win.webContents.on('did-navigate-in-page', (_, url) => checkUrl(url));

      win.loadURL('https://sub.wyzie.io/redeem');
    });
  });

  ipcMain.handle('wyzie:validate-key', async (_, key) => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(
        `https://sub.wyzie.io/search?id=550&format=srt&key=${encodeURIComponent(key)}`,
        { signal: controller.signal },
      ).finally(() => clearTimeout(timer));
      if (res.status === 401 || res.status === 403)
        return { ok: false, error: 'Invalid or expired key' };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
}

module.exports = { register };
