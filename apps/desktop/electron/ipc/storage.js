const { ipcMain } = require('electron');
const Store = require('electron-store');

const store = new Store({
  name: 'nexube-settings',
  defaults: {
    tmdbApiKey: '',
    lastProfile: 'master-id',
    preferredSource: 'videasy',
    settings: {},
  },
});

function register() {
  ipcMain.handle('storage:get', async (_, key) => {
    return store.get(key);
  });

  ipcMain.handle('storage:set', async (_, key, value) => {
    store.set(key, value);
    return true;
  });

  ipcMain.handle('storage:delete', async (_, key) => {
    store.delete(key);
    return true;
  });

  ipcMain.handle('secure:get', async (_, key) => {
    return store.get(`secure.${key}`);
  });

  ipcMain.handle('secure:set', async (_, key, value) => {
    store.set(`secure.${key}`, value);
    return true;
  });
}

module.exports = { register };
