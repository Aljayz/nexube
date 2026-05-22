const { ipcMain, BrowserWindow, session, webContents } = require('electron');
const path = require('path');

let popoutWindow = null;
const trackedWebContents = new Set();

function register(getMainWindow) {
  ipcMain.handle('player:popout', async (_, playerUrl) => {
    const mainWin = getMainWindow();
    if (!mainWin) return;

    if (popoutWindow && !popoutWindow.isDestroyed()) {
      popoutWindow.focus();
      return;
    }

    popoutWindow = new BrowserWindow({
      width: 480,
      height: 270,
      minWidth: 320,
      minHeight: 180,
      alwaysOnTop: true,
      frame: true,
      backgroundColor: '#08080C',
      title: 'PiP Player',
      webPreferences: {
        partition: 'persist:player',
        preload: path.join(__dirname, '../popout-preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        webviewTag: true,
      },
    });

    popoutWindow.setMenu(null);
    popoutWindow.loadURL(playerUrl);

    const wcId = popoutWindow.webContents.id;
    trackedWebContents.add(wcId);

    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('pip-state', true);
    }

    popoutWindow.on('closed', () => {
      trackedWebContents.delete(wcId);
      popoutWindow = null;
      if (mainWin && !mainWin.isDestroyed()) {
        mainWin.webContents.send('pip-state', false);
      }
    });
  });

  ipcMain.on('popout:close', () => {
    if (popoutWindow && !popoutWindow.isDestroyed()) {
      try { popoutWindow.close(); } catch {}
    }
  });

  ipcMain.on('popout:reattach', () => {
    if (popoutWindow && !popoutWindow.isDestroyed()) {
      try { popoutWindow.close(); } catch {}
    }
  });

  ipcMain.on('player:stop', () => {
    for (const wcId of trackedWebContents) {
      const wc = webContents.fromId(wcId);
      if (wc && !wc.isDestroyed()) {
        wc.executeJavaScript('document.querySelectorAll("video").forEach(v => { v.pause(); v.src = ""; })').catch(() => {});
        wc.clearCache();
      }
    }
    trackedWebContents.clear();
  });

  ipcMain.handle('player:getProgress', async (_, webContentsId) => {
    const wc = webContents.fromId(webContentsId);
    if (!wc || wc.isDestroyed()) return null;

    async function iterateFrames(frame) {
      try {
        const result = await frame.executeJavaScript(`
          (() => {
            const v = document.querySelector('video');
            if (!v || !v.duration || v.duration === Infinity) return null;
            return { currentTime: v.currentTime, duration: v.duration, paused: v.paused, volume: v.volume };
          })()
        `);
        if (result) return result;
      } catch {}

      for (const child of frame.frames) {
        const childResult = await iterateFrames(child);
        if (childResult) return childResult;
      }
      return null;
    }

    return iterateFrames(wc.mainFrame);
  });
}

module.exports = { register };
