const { ipcMain } = require('electron');

function register(getMainWindow) {
  ipcMain.on('window:minimize', () => {
    const win = getMainWindow();
    if (win) win.minimize();
  });

  ipcMain.on('window:toggleMaximize', () => {
    const win = getMainWindow();
    if (!win) return;
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
    win.webContents.send('window:maximize-change', win.isMaximized());
  });

  ipcMain.on('window:close', () => {
    const win = getMainWindow();
    if (win) win.close();
  });
}

module.exports = { register };
