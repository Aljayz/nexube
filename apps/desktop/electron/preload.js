const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  storage: {
    get: (key) => ipcRenderer.invoke('storage:get', key),
    set: (key, value) => ipcRenderer.invoke('storage:set', key, value),
    delete: (key) => ipcRenderer.invoke('storage:delete', key),
  },
  secureStorage: {
    get: (key) => ipcRenderer.invoke('secure:get', key),
    set: (key, value) => ipcRenderer.invoke('secure:set', key, value),
  },
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    toggleMaximize: () => ipcRenderer.send('window:toggleMaximize'),
    close: () => ipcRenderer.send('window:close'),
    setFullScreen: (fullscreen) => ipcRenderer.send('window:setFullScreen', fullscreen),
    onMaximizeChange: (callback) => ipcRenderer.on('window:maximize-change', (_, isMaximized) => callback(isMaximized)),
  },
  player: {
    popout: (url) => ipcRenderer.invoke('player:popout', url),
    popoutFullscreen: (url) => ipcRenderer.invoke('player:popoutFullscreen', url),
    stop: () => ipcRenderer.send('player:stop'),
    reattach: () => ipcRenderer.send('popout:reattach'),
    onFullscreenExit: (callback) => ipcRenderer.on('player:fullscreen-exit', () => callback()),
    offFullscreenExit: (handler) => ipcRenderer.removeListener('player:fullscreen-exit', handler),
    onAppQuitting: (callback) => ipcRenderer.on('app-quitting', callback),
    onWebviewEnterFullscreen: (callback) => {
      const handler = () => callback();
      ipcRenderer.on('webview-enter-fullscreen', handler);
      return handler;
    },
    offWebviewEnterFullscreen: (handler) => {
      if (handler) ipcRenderer.removeListener('webview-enter-fullscreen', handler);
    },
    onWebviewLeaveFullscreen: (callback) => {
      const handler = () => callback();
      ipcRenderer.on('webview-leave-fullscreen', handler);
      return handler;
    },
    offWebviewLeaveFullscreen: (handler) => {
      if (handler) ipcRenderer.removeListener('webview-leave-fullscreen', handler);
    },
  },
  tmdb: {
    fetch: (endpoint, params) => ipcRenderer.invoke('tmdb:fetch', endpoint, params),
    getImageUrl: (path, size) => ipcRenderer.invoke('tmdb:getImageUrl', path, size),
    getCertification: (mediaType, tmdbId) => ipcRenderer.invoke('tmdb:getCertification', mediaType, tmdbId),
  },
  profiles: {
    createProfile: (input) => ipcRenderer.invoke('profile:create', input),
    deleteProfile: (id) => ipcRenderer.invoke('profile:delete', id),
    listProfiles: () => ipcRenderer.invoke('profile:list'),
    getProfile: (id) => ipcRenderer.invoke('profile:get', id),
    updateProfile: (id, updates) => ipcRenderer.invoke('profile:update', id, updates),
    setActiveProfile: (id) => ipcRenderer.invoke('profile:setActive', id),
    getActiveProfileId: () => ipcRenderer.invoke('profile:getActiveId'),
    verifyPin: (id, pin) => ipcRenderer.invoke('profile:verifyPin', id, pin),
    verifyPassword: (id, password) => ipcRenderer.invoke('profile:verifyPassword', id, password),
    updateSecurity: (id, securityType, secret) => ipcRenderer.invoke('profile:updateSecurity', id, securityType, secret),
    pickAvatar: () => ipcRenderer.invoke('profile:pickAvatar'),
  },
  library: {
    favorites: {
      add: (profileId, mediaId, mediaData) => ipcRenderer.invoke('favorites:add', profileId, mediaId, mediaData),
      remove: (profileId, mediaId) => ipcRenderer.invoke('favorites:remove', profileId, mediaId),
      list: (profileId) => ipcRenderer.invoke('favorites:list', profileId),
      isFavorite: (profileId, mediaId) => ipcRenderer.invoke('favorites:isFavorite', profileId, mediaId),
    },
    saved: {
      add: (profileId, mediaId, mediaData) => ipcRenderer.invoke('saved:add', profileId, mediaId, mediaData),
      remove: (profileId, mediaId) => ipcRenderer.invoke('saved:remove', profileId, mediaId),
      list: (profileId) => ipcRenderer.invoke('saved:list', profileId),
      isSaved: (profileId, mediaId) => ipcRenderer.invoke('saved:isSaved', profileId, mediaId),
    },
    progress: {
      update: (profileId, mediaId, progress) => ipcRenderer.invoke('progress:update', profileId, mediaId, progress),
      get: (profileId, mediaId) => ipcRenderer.invoke('progress:get', profileId, mediaId),
      continueWatching: (profileId) => ipcRenderer.invoke('progress:continue-watching', profileId),
    },
    history: {
      add: (profileId, mediaId, title, posterPath, season, episode) => ipcRenderer.invoke('history:add', profileId, mediaId, title, posterPath, season, episode),
      list: (profileId) => ipcRenderer.invoke('history:list', profileId),
    },
    media: {
      upsert: (mediaData) => ipcRenderer.invoke('media:upsert', mediaData),
    },
  },
  system: {
    getMemoryInfo: () => ipcRenderer.invoke('system:getMemoryInfo'),
    clearCache: () => ipcRenderer.invoke('system:clearCache'),
    resetAllData: () => ipcRenderer.invoke('system:resetAllData'),
  },
  app: {
    quit: () => ipcRenderer.send('app:quit'),
  },
   shell: {
     openPath: (filePath) => ipcRenderer.invoke('shell:openPath', filePath),
     showItemInFolder: (filePath) => ipcRenderer.invoke('shell:showItemInFolder', filePath),
     openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
   },
   feedback: {
     openFeedbackForm: () => ipcRenderer.invoke('feedback:openForm'),
   },
   deskDownloads: {
    start: (params) => ipcRenderer.invoke('desk-download:start', params),
    queue: (params) => ipcRenderer.invoke('desk-download:queue', params),
    pause: (id) => ipcRenderer.invoke('desk-download:pause', id),
    resume: (id) => ipcRenderer.invoke('desk-download:resume', id),
    stop: (id) => ipcRenderer.invoke('desk-download:stop', id),
    kill: (id) => ipcRenderer.invoke('desk-download:kill', id),
    delete: (id) => ipcRenderer.invoke('desk-download:delete', id),
     killAll: () => ipcRenderer.invoke('desk-download:kill-all'),
     batchStopDelete: (batchId) => ipcRenderer.invoke('desk-download:batch-stop-delete', batchId),
     batchPause: (batchId) => ipcRenderer.invoke('desk-download:batch-pause', batchId),
     batchResume: (batchId) => ipcRenderer.invoke('desk-download:batch-resume', batchId),
     batchStop: (batchId) => ipcRenderer.invoke('desk-download:batch-stop', batchId),
    list: (profileId) => ipcRenderer.invoke('desk-download:list', profileId),
    getActive: (profileId) => ipcRenderer.invoke('desk-download:getActive', profileId),
    play: (id) => ipcRenderer.invoke('desk-download:play', id),
    playExternal: (id) => ipcRenderer.invoke('desk-download:play-external', id),
    checkBundled: () => ipcRenderer.invoke('desk-download:check-bundled'),
    checkFolder: (folderPath) => ipcRenderer.invoke('desk-download:check-folder', folderPath),
    pickFolder: (defaultPath) => ipcRenderer.invoke('desk-download:pick-folder', { defaultPath }),
    defaultPath: () => ipcRenderer.invoke('desk-download:default-path'),
    scan: (params) => ipcRenderer.invoke('desk-download:scan', params),
    showInFolder: (downloadId) => ipcRenderer.invoke('desk-download:show-in-folder', downloadId),
    readLog: (logPath) => ipcRenderer.invoke('desk-download:read-log', logPath),
    exportSingle: (id) => ipcRenderer.invoke('desk-download:export-single', id),
    exportBulk: (params) => ipcRenderer.invoke('desk-download:export-bulk', params),
    getVaultInfo: (id) => ipcRenderer.invoke('desk-download:get-vault-info', id),
     onProgress: (callback) => {
       const handler = (_, data) => callback(data);
       ipcRenderer.on('desk-download:progress', handler);
       return handler;
     },
     offProgress: (handler) => {
       if (handler) ipcRenderer.removeListener('desk-download:progress', handler);
     },
     queueBatch: (params) => ipcRenderer.invoke('desk-download:queue-batch', params),
     onBatchProgress: (callback) => {
       const handler = (_, data) => callback(data);
       ipcRenderer.on('download:batch-progress', handler);
       return handler;
     },
      offBatchProgress: (handler) => {
        if (handler) ipcRenderer.removeListener('download:batch-progress', handler);
      },
      onDiag: (callback) => {
        const handler = (_, msg) => {
          console.log('[main]', msg);
          if (callback) callback(msg);
        };
        ipcRenderer.on('desk-download:diag', handler);
        return handler;
      },
      offDiag: (handler) => {
        if (handler) ipcRenderer.removeListener('desk-download:diag', handler);
      },
    },
  onM3u8Found: (callback) => {
    const handler = (_, url) => callback(url);
    ipcRenderer.on('m3u8-found', handler);
    return handler;
  },
  offM3u8Found: (handler) => {
    if (handler) ipcRenderer.removeListener('m3u8-found', handler);
  },
  onSubtitleFound: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('subtitle-found', handler);
    return handler;
  },
  offSubtitleFound: (handler) => {
    if (handler) ipcRenderer.removeListener('subtitle-found', handler);
  },
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  resolveAllmanga: (params) => ipcRenderer.invoke('resolve-allmanga', params),
  setPlayerVideo: (params) => ipcRenderer.invoke('set-player-video', params),
  getBlockStats: () => ipcRenderer.invoke('get-block-stats'),
  onPipStateChange: (callback) => {
    const handler = (_, active) => callback(active);
    ipcRenderer.on('pip-state', handler);
    return handler;
  },
  offPipStateChange: (handler) => {
    if (handler) ipcRenderer.removeListener('pip-state', handler);
  },
  recordBlockedPopup: (url) => ipcRenderer.invoke('record-blocked-popup', url),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  update: {
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    install: () => ipcRenderer.invoke('update:install'),
    getStatus: () => ipcRenderer.invoke('update:getStatus'),
    setEnabled: (enabled) => ipcRenderer.invoke('update:setEnabled', enabled),
    getLatestVersion: () => ipcRenderer.invoke('update:getLatestVersion'),
    getReleaseNotes: (version) => ipcRenderer.invoke('update:getReleaseNotes', version),
    storeVersion: (version) => ipcRenderer.invoke('update:storeVersion', version),
    getPreviousVersion: () => ipcRenderer.invoke('update:getPreviousVersion'),
    onWhatsNew: (callback) => {
      const h = (_, data) => callback(data);
      ipcRenderer.on('show-whats-new', h);
      return h;
    },
    offWhatsNew: (handler) => {
      if (handler) ipcRenderer.removeListener('show-whats-new', handler);
    },
    onChecking: (callback) => {
      const h = () => callback();
      ipcRenderer.on('update:checking', h);
      return h;
    },
    onAvailable: (callback) => {
      const h = (_, info) => callback(info);
      ipcRenderer.on('update:available', h);
      return h;
    },
    onNotAvailable: (callback) => {
      const h = (_, info) => callback(info);
      ipcRenderer.on('update:not-available', h);
      return h;
    },
    onError: (callback) => {
      const h = (_, err) => callback(err);
      ipcRenderer.on('update:error', h);
      return h;
    },
    onProgress: (callback) => {
      const h = (_, progress) => callback(progress);
      ipcRenderer.on('update:progress', h);
      return h;
    },
    onDownloaded: (callback) => {
      const h = (_, info) => callback(info);
      ipcRenderer.on('update:downloaded', h);
      return h;
    },
    removeListener: (channel, handler) => {
      ipcRenderer.removeListener(channel, handler);
    },
  },
  onBlockedUpdate: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('blocked-stats-update', handler);
    return handler;
  },
  offBlockedUpdate: (handler) => {
    if (handler) ipcRenderer.removeListener('blocked-stats-update', handler);
  },
});
