import { useState, useEffect } from 'react';
import { RefreshCw, Download, RotateCw, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { APP_VERSION } from '../../version';

export default function UpdateSettings() {
  const [autoUpdaterEnabled, setAutoUpdaterEnabled] = useState(true);
  const [latestVersion, setLatestVersion] = useState(null);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const load = async () => {
      const status = await window.electron?.update?.getStatus?.();
      if (status) setAutoUpdaterEnabled(status.enabled);
    };
    load();
  }, []);

  useEffect(() => {
    if (!window.electron?.update) return;
    const handlers = [
      window.electron.update.onChecking(() => setStatus('checking')),
      window.electron.update.onAvailable((info) => {
        setStatus('available');
        setLatestVersion(info.version);
      }),
      window.electron.update.onNotAvailable(() => {
        setStatus('up-to-date');
      }),
      window.electron.update.onError(() => setStatus('error')),
      window.electron.update.onProgress((p) => {
        setStatus('downloading');
        setProgress(p.percent);
      }),
      window.electron.update.onDownloaded(() => {
        setStatus('downloaded');
        setProgress(100);
      }),
    ];
    return () => {
      handlers.forEach((h, i) => {
        const channels = ['checking', 'available', 'not-available', 'error', 'progress', 'downloaded'];
        window.electron.update.removeListener(`update:${channels[i]}`, h);
      });
    };
  }, []);

  const handleToggle = async (enabled) => {
    setAutoUpdaterEnabled(enabled);
    await window.electron?.update?.setEnabled?.(enabled);
  };

  const handleCheck = async () => {
    setChecking(true);
    setStatus('checking');
    setLatestVersion(null);
    try {
      const result = await window.electron?.update?.getLatestVersion?.();
      if (result?.success) {
        setLatestVersion(result.latestVersion);
        if (result.latestVersion && result.latestVersion !== APP_VERSION) {
          setStatus('available');
        } else {
          setStatus('up-to-date');
        }
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    } finally {
      setChecking(false);
    }
  };

  const handleDownload = async () => {
    await window.electron?.update?.download?.();
  };

  const handleInstall = async () => {
    await window.electron?.update?.install?.();
  };

  const isUpdateAvailable = latestVersion && latestVersion !== APP_VERSION;

  return (
    <div className="space-y-lg">
      <div className="bg-surface rounded-card border border-border p-lg space-y-lg">
        <div>
          <h2 className="text-lg font-bold text-text-primary mb-sm">Version</h2>
          <div className="flex items-center gap-sm">
            <span className="text-sm text-text-muted">Current version:</span>
            <span className="text-sm font-semibold text-text-primary">{APP_VERSION}</span>
            {latestVersion && (
              <>
                <span className="text-text-muted">→</span>
                <span className="text-sm text-text-muted">Latest:</span>
                <span className={`text-sm font-semibold ${isUpdateAvailable ? 'text-accent' : 'text-text-primary'}`}>
                  {latestVersion}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-sm font-medium text-text-primary">Auto Updates</span>
            <p className="text-xs text-text-muted">
              {autoUpdaterEnabled
                ? 'Automatically check for updates on launch'
                : 'Updates will not be checked automatically'}
            </p>
          </div>
          <button
            onClick={() => handleToggle(!autoUpdaterEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
              autoUpdaterEnabled ? 'bg-accent' : 'bg-border'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                autoUpdaterEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="bg-surface rounded-card border border-border p-lg space-y-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-text-primary">Check for Updates</h2>
            <p className="text-sm text-text-muted mt-xs">
              {!autoUpdaterEnabled
                ? 'Enable auto updates above to check for updates'
                : 'Look for the latest version of Nexube'}
            </p>
          </div>
          <button
            onClick={handleCheck}
            disabled={checking || !autoUpdaterEnabled}
            className="btn-primary inline-flex items-center gap-sm"
          >
            {checking ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Check
              </>
            )}
          </button>
        </div>

        {status === 'checking' && (
          <div className="flex items-center gap-sm text-sm text-text-muted">
            <RotateCw className="w-4 h-4 animate-spin" />
            Checking for updates...
          </div>
        )}

        {status === 'up-to-date' && (
          <div className="flex items-center gap-sm text-sm text-green-400">
            <CheckCircle className="w-4 h-4" />
            You're on the latest version.
          </div>
        )}

        {status === 'available' && (
          <div className="flex items-center gap-sm text-sm text-accent">
            <Download className="w-4 h-4" />
            Update {latestVersion} is available.
          </div>
        )}

        {status === 'error' && (
          <div className="flex items-center gap-sm text-sm text-danger">
            <AlertCircle className="w-4 h-4" />
            Could not check for updates. Check your connection.
          </div>
        )}

        {status === 'downloading' && (
          <div className="space-y-sm">
            <div className="flex items-center gap-sm text-sm text-text-muted">
              <RotateCw className="w-4 h-4 animate-spin" />
              Downloading update...
            </div>
            <div className="w-full bg-background rounded-full h-2">
              <div
                className="bg-accent h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {status === 'downloaded' && (
          <div className="flex items-center gap-sm text-sm text-green-400">
            <CheckCircle className="w-4 h-4" />
            Update downloaded. Remember to restart to install it.
          </div>
        )}
      </div>

      {isUpdateAvailable && (
        <div className="bg-surface rounded-card border border-border p-lg">
          <div className="flex items-center justify-between gap-md">
            <div className="flex items-center gap-sm">
              <Clock className="w-5 h-5 text-accent" />
              <div>
                <p className="text-sm font-medium text-text-primary">
                  Update {latestVersion} ready to install
                </p>
                <p className="text-xs text-text-muted mt-0.5">
                  Download and install the latest version
                </p>
              </div>
            </div>
            <div className="flex gap-sm">
              <button
                onClick={handleDownload}
                disabled={status === 'downloading' || status === 'downloaded'}
                className="btn-primary inline-flex items-center gap-sm"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
              {status === 'downloaded' && (
                <button
                  onClick={handleInstall}
                  className="px-md py-sm bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-input transition-colors inline-flex items-center gap-sm"
                >
                  <RotateCw className="w-4 h-4" />
                  Install & Restart
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
