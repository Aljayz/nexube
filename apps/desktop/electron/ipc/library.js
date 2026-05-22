const { ipcMain } = require('electron');
const {
  upsertMedia,
  addFavorite,
  removeFavorite,
  getFavorites,
  isFavorite,
  addSaved,
  removeSaved,
  getSaved,
  isSaved,
  updateWatchProgress,
  getWatchProgress,
  getContinueWatching,
  addWatchHistory,
  getWatchHistory,
} = require('@nexube/store');

function register() {
  // ── Favorites ──────────────────────────────────────────────────────────────
  ipcMain.handle('favorites:add', async (_, profileId, mediaId, mediaData) => {
    if (mediaData) upsertMedia({ id: mediaId, ...mediaData });
    addFavorite(profileId, mediaId);
    return true;
  });

  ipcMain.handle('favorites:remove', async (_, profileId, mediaId) => {
    removeFavorite(profileId, mediaId);
    return true;
  });

  ipcMain.handle('favorites:list', async (_, profileId) => {
    return getFavorites(profileId);
  });

  ipcMain.handle('favorites:isFavorite', async (_, profileId, mediaId) => {
    return isFavorite(profileId, mediaId);
  });

  // ── Saved / Watchlist ──────────────────────────────────────────────────────
  ipcMain.handle('saved:add', async (_, profileId, mediaId, mediaData) => {
    if (mediaData) upsertMedia({ id: mediaId, ...mediaData });
    addSaved(profileId, mediaId);
    return true;
  });

  ipcMain.handle('saved:remove', async (_, profileId, mediaId) => {
    removeSaved(profileId, mediaId);
    return true;
  });

  ipcMain.handle('saved:list', async (_, profileId) => {
    return getSaved(profileId);
  });

  ipcMain.handle('saved:isSaved', async (_, profileId, mediaId) => {
    return isSaved(profileId, mediaId);
  });

  // ── Watch Progress ─────────────────────────────────────────────────────────
  ipcMain.handle('progress:update', async (_, profileId, mediaId, progress) => {
    updateWatchProgress(profileId, mediaId, progress);
    return true;
  });

  ipcMain.handle('progress:get', async (_, profileId, mediaId) => {
    return getWatchProgress(profileId, mediaId);
  });

  ipcMain.handle('progress:continue-watching', async (_, profileId) => {
    return getContinueWatching(profileId);
  });

  // ── Watch History ──────────────────────────────────────────────────────────
  ipcMain.handle('history:add', async (_, profileId, mediaId, title, posterPath, season, episode) => {
    addWatchHistory(profileId, mediaId, title, posterPath, season, episode);
    return true;
  });

  ipcMain.handle('history:list', async (_, profileId) => {
    return getWatchHistory(profileId);
  });

  // ── Media Cache (helper to upsert media metadata) ──────────────────────────
  ipcMain.handle('media:upsert', async (_, mediaData) => {
    upsertMedia(mediaData);
    return true;
  });
}

module.exports = { register };
