const { ipcMain, dialog, BrowserWindow, app } = require('electron');
const path = require('path');
const fs = require('fs');
const {
  getProfiles,
  createProfile,
  deleteProfile,
  getProfile,
  updateProfile,
  setActiveProfileId,
  getActiveProfileId,
  verifyPin,
  verifyPassword,
  updateProfileSecurity,
} = require('@nexube/store');

function register() {
  ipcMain.handle('profile:list', async () => {
    return getProfiles();
  });

  ipcMain.handle('profile:get', async (_, id) => {
    return getProfile(id);
  });

  ipcMain.handle('profile:create', async (_, input) => {
    return createProfile(input);
  });

  ipcMain.handle('profile:update', async (_, id, updates) => {
    updateProfile(id, updates);
    return getProfile(id);
  });

  ipcMain.handle('profile:delete', async (_, id) => {
    deleteProfile(id);
    return true;
  });

  ipcMain.handle('profile:setActive', async (_, id) => {
    setActiveProfileId(id);
    return true;
  });

  ipcMain.handle('profile:getActiveId', async () => {
    return getActiveProfileId();
  });

  ipcMain.handle('profile:verifyPin', async (_, id, pin) => {
    return verifyPin(id, pin);
  });

  ipcMain.handle('profile:verifyPassword', async (_, id, password) => {
    return verifyPassword(id, password);
  });

  ipcMain.handle('profile:updateSecurity', async (_, id, securityType, secret) => {
    updateProfileSecurity(id, securityType, secret);
    return getProfile(id);
  });

  ipcMain.handle('profile:pickAvatar', async () => {
    const mainWindow = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const srcPath = result.filePaths[0];
    const ext = path.extname(srcPath);
    const destDir = path.join(app.getPath('userData'), 'avatars');

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const destName = `custom-${Date.now()}${ext}`;
    const destPath = path.join(destDir, destName);
    fs.copyFileSync(srcPath, destPath);

    return destPath;
  });
}

module.exports = { register };
