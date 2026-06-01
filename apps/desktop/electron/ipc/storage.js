const { ipcMain } = require('electron');
const Store = require('../lib/store');

let _store = null;
function getStore() {
  if (!_store) {
    _store = new Store({
      name: 'nexube-settings',
      defaults: {
        tmdbApiKey: '',
        wyzieApiKey: '',
        subtitleLanguages: ['en'],
        lastProfile: 'master-id',
        preferredSource: 'videasy',
        settings: {},
      },
    });
  }
  return _store;
}

function register() {
  ipcMain.handle('storage:get', async (_, key) => {
    return getStore().get(key);
  });

  ipcMain.handle('storage:set', async (_, key, value) => {
    getStore().set(key, value);
    return true;
  });

  ipcMain.handle('storage:delete', async (_, key) => {
    getStore().delete(key);
    return true;
  });

  ipcMain.handle('secure:get', async (_, key) => {
    return getStore().get(`secure.${key}`);
  });

  ipcMain.handle('secure:set', async (_, key, value) => {
    getStore().set(`secure.${key}`, value);
    return true;
  });

  ipcMain.handle('storage:get-wyzie-key', async () => {
    return getStore().get('wyzieApiKey', '');
  });

  ipcMain.handle('storage:set-wyzie-key', async (_, value) => {
    getStore().set('wyzieApiKey', value);
    return true;
  });
}

function clearCache() {
  _store = null;
}

module.exports = { register, clearCache, getStore };
