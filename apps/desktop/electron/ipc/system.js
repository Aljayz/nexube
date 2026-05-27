const { ipcMain, app } = require('electron');
const fs = require('fs');
const path = require('path');
const Store = require('../lib/store');
const { getDatabase, closeDatabase } = require('@nexube/store');

const store = new Store({ name: 'nexube-settings' });

function getDirectorySize(dirPath) {
  let total = 0;
  try {
    if (!fs.existsSync(dirPath)) return 0;
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        total += getDirectorySize(filePath);
      } else {
        total += stat.size;
      }
    }
  } catch {}
  return total;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function register() {
  ipcMain.handle('system:getMemoryInfo', async () => {
    const mem = process.memoryUsage();
    const dbPath = path.join(process.cwd(), 'nexube.db');
    const dbSize = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;
    const dbWalSize = fs.existsSync(dbPath + '-wal') ? fs.statSync(dbPath + '-wal').size : 0;
    const dbShmSize = fs.existsSync(dbPath + '-shm') ? fs.statSync(dbPath + '-shm').size : 0;
    const totalDbSize = dbSize + dbWalSize + dbShmSize;

    const storePath = path.join(app.getPath('userData'), 'nexube-settings.json');
    const storeSize = fs.existsSync(storePath) ? fs.statSync(storePath).size : 0;

    return {
      rss: formatBytes(mem.rss),
      heapTotal: formatBytes(mem.heapTotal),
      heapUsed: formatBytes(mem.heapUsed),
      external: formatBytes(mem.external),
      dbSize: formatBytes(totalDbSize),
      dbSizeRaw: totalDbSize,
      storeSize: formatBytes(storeSize),
      storeSizeRaw: storeSize,
    };
  });

  ipcMain.handle('system:clearCache', async () => {
    try {
      const { clearCache } = require('./tmdb');
      clearCache();
      return { success: true, message: 'TMDB cache cleared' };
    } catch (err) {
      return { success: false, message: err.message || 'Failed to clear cache' };
    }
  });

  ipcMain.handle('system:resetAllData', async () => {
    try {
      closeDatabase();

      const dbPath = path.join(process.cwd(), 'nexube.db');
      const dbWalPath = dbPath + '-wal';
      const dbShmPath = dbPath + '-shm';

      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
      if (fs.existsSync(dbWalPath)) fs.unlinkSync(dbWalPath);
      if (fs.existsSync(dbShmPath)) fs.unlinkSync(dbShmPath);

      store.clear();
      const { clearCache: clearStorageCache } = require('./storage');
      clearStorageCache();

      getDatabase();

      return { success: true, message: 'All data has been reset. The app will restart.' };
    } catch (err) {
      return { success: false, message: err.message || 'Failed to reset data' };
    }
  });

  ipcMain.on('app:quit', () => {
    const { BrowserWindow } = require('electron');
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      win.close();
    }
  });
}

module.exports = { register };
