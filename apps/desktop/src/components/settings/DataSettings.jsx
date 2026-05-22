import { useState, useEffect, useCallback } from 'react';
import { HardDrive, Database, Trash2, RefreshCw, AlertTriangle, Check } from 'lucide-react';

export default function DataSettings() {
  const [memoryInfo, setMemoryInfo] = useState(null);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [clearCacheStatus, setClearCacheStatus] = useState(null);
  const [resetStatus, setResetStatus] = useState(null);
  const [resetConfirm, setResetConfirm] = useState(false);

  const loadMemoryInfo = useCallback(async () => {
    setMemoryLoading(true);
    try {
      const info = await window.electron?.system?.getMemoryInfo();
      setMemoryInfo(info);
    } catch (err) {
      console.error('Failed to load memory info:', err);
    } finally {
      setMemoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMemoryInfo();
    const interval = setInterval(loadMemoryInfo, 10000);
    return () => clearInterval(interval);
  }, [loadMemoryInfo]);

  const handleClearCache = async () => {
    setClearCacheStatus('loading');
    try {
      const result = await window.electron?.system?.clearCache();
      if (result?.success) {
        setClearCacheStatus('success');
        loadMemoryInfo();
      } else {
        setClearCacheStatus('error');
      }
    } catch (err) {
      setClearCacheStatus('error');
    }
    setTimeout(() => setClearCacheStatus(null), 3000);
  };

  const handleResetAllData = async () => {
    setResetStatus('loading');
    try {
      const result = await window.electron?.system?.resetAllData();
      if (result?.success) {
        setResetStatus('success');
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setResetStatus('error');
      }
    } catch (err) {
      setResetStatus('error');
    }
    setTimeout(() => setResetStatus(null), 5000);
  };

  return (
    <div className="space-y-lg">
      <div className="bg-surface rounded-card p-lg border border-border">
        <div className="flex items-center justify-between mb-md">
          <h2 className="text-lg font-bold text-text-primary flex items-center gap-sm">
            <HardDrive className="w-5 h-5" />
            Memory Usage
          </h2>
          <button
            onClick={loadMemoryInfo}
            disabled={memoryLoading}
            className="p-sm text-text-muted hover:text-text-primary transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${memoryLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {memoryInfo ? (
          <div className="grid grid-cols-2 gap-md">
            <div className="bg-background rounded-lg p-md">
              <p className="text-xs text-text-muted mb-xs">RAM (RSS)</p>
              <p className="text-lg font-mono font-bold text-text-primary">{memoryInfo.rss}</p>
            </div>
            <div className="bg-background rounded-lg p-md">
              <p className="text-xs text-text-muted mb-xs">Heap Used</p>
              <p className="text-lg font-mono font-bold text-text-primary">{memoryInfo.heapUsed}</p>
            </div>
            <div className="bg-background rounded-lg p-md">
              <p className="text-xs text-text-muted mb-xs">Heap Total</p>
              <p className="text-lg font-mono font-bold text-text-primary">{memoryInfo.heapTotal}</p>
            </div>
            <div className="bg-background rounded-lg p-md">
              <p className="text-xs text-text-muted mb-xs">External</p>
              <p className="text-lg font-mono font-bold text-text-primary">{memoryInfo.external}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-lg text-text-muted">
            <RefreshCw className="w-4 h-4 animate-spin mr-sm" />
            Loading...
          </div>
        )}
      </div>

      <div className="bg-surface rounded-card p-lg border border-border">
        <h2 className="text-lg font-bold text-text-primary mb-md flex items-center gap-sm">
          <Database className="w-5 h-5" />
          Storage
        </h2>
        <div className="grid grid-cols-2 gap-md mb-md">
          <div className="bg-background rounded-lg p-md">
            <p className="text-xs text-text-muted mb-xs">Database</p>
            <p className="text-lg font-mono font-bold text-text-primary">{memoryInfo?.dbSize || '—'}</p>
          </div>
          <div className="bg-background rounded-lg p-md">
            <p className="text-xs text-text-muted mb-xs">Settings Store</p>
            <p className="text-lg font-mono font-bold text-text-primary">{memoryInfo?.storeSize || '—'}</p>
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-card p-lg border border-border">
        <h2 className="text-lg font-bold text-text-primary mb-md">Clear Cache</h2>
        <p className="text-sm text-text-muted mb-md">
          Clear the TMDB API response cache. This will not delete your library, favorites, or watch history.
        </p>
        <button
          onClick={handleClearCache}
          disabled={clearCacheStatus === 'loading'}
          className="btn-primary disabled:opacity-50"
        >
          {clearCacheStatus === 'loading' ? (
            <span className="flex items-center gap-sm">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Clearing...
            </span>
          ) : clearCacheStatus === 'success' ? (
            <span className="flex items-center gap-sm">
              <Check className="w-4 h-4" />
              Cache Cleared
            </span>
          ) : clearCacheStatus === 'error' ? (
            'Failed'
          ) : (
            'Clear Cache'
          )}
        </button>
      </div>

      <div className="bg-surface rounded-card p-lg border border-red-500/30">
        <h2 className="text-lg font-bold text-red-400 mb-md flex items-center gap-sm">
          <AlertTriangle className="w-5 h-5" />
          Reset All Data
        </h2>
        <p className="text-sm text-text-muted mb-md">
          This will permanently delete all data including your library, favorites, watchlist, watch history, progress, profiles, and settings. This action cannot be undone.
        </p>

        {!resetConfirm ? (
            <button
              onClick={() => setResetConfirm(true)}
              className="flex items-center gap-sm px-md py-sm bg-surface border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-button transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Reset All Data
            </button>
        ) : (
          <div className="bg-red-500/10 rounded-lg p-md border border-red-500/30">
            <p className="text-sm text-red-300 mb-md font-medium">
              Are you absolutely sure? This will erase everything.
            </p>
            <div className="flex gap-md">
              <button
                onClick={handleResetAllData}
                disabled={resetStatus === 'loading'}
                className="btn-danger disabled:opacity-50"
              >
                {resetStatus === 'loading' ? (
                  <span className="flex items-center gap-sm">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Resetting...
                  </span>
                ) : resetStatus === 'success' ? (
                  <span className="flex items-center gap-sm">
                    <Check className="w-4 h-4" />
                    Reset Complete
                  </span>
                ) : resetStatus === 'error' ? (
                  'Failed'
                ) : (
                  'Confirm'
                )}
              </button>
              <button
                onClick={() => setResetConfirm(false)}
                className="btn-cancel"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
