const { ipcMain, BrowserWindow } = require('electron');
const { autoUpdater } = require('electron-updater');
const ElectronStore = require('electron-store');

let _store = null;
function getStore() {
  if (!_store) _store = new ElectronStore({ name: 'updater-settings' });
  return _store;
}

const UPDATE_CHANNEL = 'update';

function getWin() {
  return BrowserWindow.getAllWindows()[0];
}

function send(channel, ...args) {
  const win = getWin();
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, ...args);
  }
}

function register() {
  const isEnabled = () => getStore().get('autoUpdaterEnabled', true);

  autoUpdater.autoDownload = false;

  autoUpdater.on('checking-for-update', () => {
    send(`${UPDATE_CHANNEL}:checking`);
  });

  autoUpdater.on('update-available', (info) => {
    send(`${UPDATE_CHANNEL}:available`, {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseName: info.releaseName,
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    send(`${UPDATE_CHANNEL}:not-available`, { version: info.version });
  });

  autoUpdater.on('error', (err) => {
    send(`${UPDATE_CHANNEL}:error`, { message: err.message });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    send(`${UPDATE_CHANNEL}:progress`, {
      percent: progressObj.percent,
      bytesPerSecond: progressObj.bytesPerSecond,
      transferred: progressObj.transferred,
      total: progressObj.total,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    send(`${UPDATE_CHANNEL}:downloaded`, {
      version: info.version,
      releaseDate: info.releaseDate,
    });
  });

  ipcMain.handle('update:check', async () => {
    if (!isEnabled()) return { success: false, error: 'Auto-updater is disabled' };
    try {
      await autoUpdater.checkForUpdates();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('update:download', async () => {
    try {
      autoUpdater.downloadUpdate();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('update:install', async () => {
    setImmediate(() => autoUpdater.quitAndInstall());
    return { success: true };
  });

  ipcMain.handle('update:getStatus', async () => {
    return {
      enabled: isEnabled(),
    };
  });

  ipcMain.handle('update:setEnabled', async (_, enabled) => {
    getStore().set('autoUpdaterEnabled', enabled);
    return { success: true };
  });

  ipcMain.handle('update:getLatestVersion', async () => {
    if (!isEnabled()) return { success: false, error: 'Auto-updater is disabled' };
    try {
      const result = await autoUpdater.checkForUpdates();
      const latest = result?.updateInfo?.version;
      return { success: true, latestVersion: latest || null };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { register };
