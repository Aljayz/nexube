import { useState, useEffect } from 'react';
import { Download, FolderOpen, HardDrive, RefreshCw, Check, AlertCircle, Search, X } from 'lucide-react';

export default function DownloadSettings({ activeProfile, onProfileUpdated }) {
  const [downloadPath, setDownloadPath] = useState(activeProfile?.downloadPath || '');
  const [binaryFolder, setBinaryFolder] = useState(() => {
    try { return localStorage.getItem('nexube-downloader-folder') || ''; } catch { return ''; }
  });
  const [binaryStatus, setBinaryStatus] = useState(null);
  const [checkingBinary, setCheckingBinary] = useState(false);
  const [bundledStatus, setBundledStatus] = useState(null);
  const [mode, setMode] = useState(() => {
    try { return localStorage.getItem('nexube-downloader-mode') || 'bundled'; } catch { return 'bundled'; }
  });

  useEffect(() => {
    try { localStorage.setItem('nexube-downloader-mode', mode); } catch {}
    if (mode === 'bundled') {
      handleCheckBundled();
    } else if (mode === 'custom' && binaryFolder) {
      checkBinary(binaryFolder);
    }
  }, [mode]);

  useEffect(() => {
    if (binaryFolder && mode === 'custom') {
      checkBinary(binaryFolder);
    }
  }, []);

  useEffect(() => {
    if (mode === 'bundled') {
      handleCheckBundled();
    }
  }, []);

  const handlePickDownloadPath = async () => {
    const folder = await window.electron?.deskDownloads?.pickFolder(downloadPath);
    if (folder) {
      setDownloadPath(folder);
      await window.electron?.profiles?.updateProfile(activeProfile.id, { downloadPath: folder });
      if (onProfileUpdated) onProfileUpdated();
    }
  };

  const handlePickBinary = async () => {
    const folder = await window.electron?.deskDownloads?.pickFolder(binaryFolder);
    if (folder) {
      setBinaryFolder(folder);
      try { localStorage.setItem('nexube-downloader-folder', folder); } catch {}
      checkBinary(folder);
    }
  };

  const checkBinary = async (folder) => {
    setCheckingBinary(true);
    setBinaryStatus(null);
    try {
      const result = await window.electron?.deskDownloads?.checkFolder(folder);
      setBinaryStatus(result?.exists ? 'valid' : result?.reason || 'invalid');
    } catch {
      setBinaryStatus('error');
    }
    setCheckingBinary(false);
  };

  const handleCheckBundled = async () => {
    setBundledStatus(null);
    try {
      const result = await window.electron?.deskDownloads?.checkBundled();
      setBundledStatus(result?.exists ? 'valid' : 'not_found');
    } catch {
      setBundledStatus('error');
    }
  };

  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);

  const handleScan = async () => {
    setScanning(true);
    setScanResult(null);
    const result = await window.electron?.deskDownloads?.scan({ profileId: activeProfile?.id, downloadPath });
    if (result) setScanResult(result);
    setScanning(false);
  };

  const handleResetBinary = () => {
    setBinaryFolder('');
    setBinaryStatus(null);
    try { localStorage.removeItem('nexube-downloader-folder'); } catch {}
  };

  return (
    <div className="space-y-lg">
      <div className="bg-surface rounded-card p-lg border border-border">
        <h2 className="text-lg font-bold text-text-primary mb-md flex items-center gap-sm">
          <HardDrive className="w-5 h-5" />
          Download Path
        </h2>
        <p className="text-sm text-text-muted mb-md">
          Choose where downloaded files are saved. A <code className="px-xs py-2xs bg-background rounded text-xs">Nexube</code> folder will be created inside with <code className="px-xs py-2xs bg-background rounded text-xs">Movies</code> and <code className="px-xs py-2xs bg-background rounded text-xs">TV</code> subdirectories.
        </p>
        <div className="flex items-center gap-sm mb-sm">
          <div className="flex-1 px-sm py-sm bg-background border border-border rounded text-sm text-text-muted font-mono truncate">
            {downloadPath || <span className="text-text-muted/50">Not set — will use default (Downloads/Nexube)</span>}
          </div>
          <button
            onClick={handlePickDownloadPath}
            className="flex items-center gap-xs px-md py-sm bg-accent text-white rounded-md hover:bg-accent/80 transition-colors text-sm"
          >
            <FolderOpen className="w-4 h-4" />
            Change
          </button>
        </div>
      </div>

      <div className="bg-surface rounded-card p-lg border border-border">
        <h2 className="text-lg font-bold text-text-primary mb-md flex items-center gap-sm">
          <Download className="w-5 h-5" />
          Downloader Binary
        </h2>
        <p className="text-sm text-text-muted mb-md">
          Choose whether to use the bundled downloader or a custom binary.
        </p>

        <div className="flex items-center justify-between mb-md bg-background rounded-lg p-md">
          <div className="flex items-center gap-md">
            <Search className="w-4 h-4 text-text-muted" />
            <span className="text-sm text-text-muted">Scan download folder for existing videos</span>
          </div>
          <button
            onClick={handleScan}
            disabled={scanning}
            className="flex items-center gap-xs text-sm px-md py-sm bg-accent text-white rounded-md hover:bg-accent/80 transition-colors disabled:opacity-50"
          >
            {scanning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            Scan
          </button>
        </div>

        {scanResult && (
          <div className={`mb-md p-md rounded-card flex items-center justify-between ${scanResult.imported > 0 ? 'bg-success/10 border border-success/30' : 'bg-background border border-border'}`}>
            <div className="flex items-center gap-sm">
              {scanResult.imported > 0 ? <Check className="w-4 h-4 text-success" /> : <Search className="w-4 h-4 text-text-muted" />}
              <span className="text-sm">
                {scanResult.imported > 0
                  ? `Found ${scanResult.found} file(s), imported ${scanResult.imported} new`
                  : scanResult.found > 0
                    ? `${scanResult.found} file(s) found, all already tracked`
                    : 'No video files found in download path'}
              </span>
            </div>
            <button onClick={() => setScanResult(null)} className="text-text-muted hover:text-text-primary">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-md mb-md bg-background rounded-lg p-md">
          <span className={`text-sm font-medium ${mode === 'bundled' ? 'text-text-primary' : 'text-text-muted'}`}>Bundled</span>
          <button
            onClick={() => setMode(mode === 'bundled' ? 'custom' : 'bundled')}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${mode === 'bundled' ? 'bg-accent' : 'bg-border'}`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${mode === 'bundled' ? 'translate-x-[1.125rem]' : 'translate-x-0.5'}`} />
          </button>
          <span className={`text-sm font-medium ${mode === 'custom' ? 'text-text-primary' : 'text-text-muted'}`}>Custom</span>
        </div>

        {mode === 'bundled' ? (
          <div className="bg-background rounded-lg p-md">
            <div className="flex items-center justify-between mb-sm">
              <span className="text-sm font-medium text-text-primary">Bundled Downloader</span>
              <button
                onClick={handleCheckBundled}
                className="text-xs text-accent hover:underline"
              >
                {bundledStatus === null ? 'Check status' : 'Re-check'}
              </button>
            </div>
            {bundledStatus === null ? (
              <p className="text-xs text-text-muted">Checking...</p>
            ) : bundledStatus === 'valid' ? (
              <p className="text-xs text-success flex items-center gap-2xs">
                <Check className="w-3 h-3" /> Bundled downloader is available
              </p>
            ) : bundledStatus === 'not_found' ? (
              <p className="text-xs text-danger flex items-center gap-2xs">
                <AlertCircle className="w-3 h-3" /> Bundled downloader not found — use custom binary instead
              </p>
            ) : (
              <p className="text-xs text-danger">Failed to check bundled downloader</p>
            )}
          </div>
        ) : (
          <div className="bg-background rounded-lg p-md">
            <div className="flex items-center justify-between mb-sm">
              <span className="text-sm font-medium text-text-primary">Custom Binary Path</span>
              {binaryFolder && (
                <button
                  onClick={handleResetBinary}
                  className="text-xs text-text-muted hover:text-danger transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex items-center gap-sm mb-sm">
              <input
                className="flex-1 px-sm py-sm bg-surface border border-border rounded text-sm text-text-muted font-mono"
                placeholder="Type or paste the binary folder path"
                value={binaryFolder}
                onChange={(e) => {
                  setBinaryFolder(e.target.value);
                  try { localStorage.setItem('nexube-downloader-folder', e.target.value); } catch {}
                  setBinaryStatus(null);
                }}
              />
              <button
                onClick={handlePickBinary}
                className="flex items-center gap-xs px-md py-sm bg-accent text-white rounded-md hover:bg-accent/80 transition-colors text-sm shrink-0"
              >
                <FolderOpen className="w-4 h-4" />
                Browse
              </button>
              <button
                onClick={() => checkBinary(binaryFolder)}
                disabled={!binaryFolder || checkingBinary}
                className="flex items-center gap-xs px-md py-sm bg-surface border border-border text-text-primary rounded-md hover:bg-surface/80 transition-colors text-sm shrink-0 disabled:opacity-50"
              >
                {checkingBinary ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Check
              </button>
            </div>
            {checkingBinary && (
              <p className="text-xs text-text-muted flex items-center gap-2xs">
                <RefreshCw className="w-3 h-3 animate-spin" /> Checking...
              </p>
            )}
            {binaryStatus === 'valid' && (
              <p className="text-xs text-success flex items-center gap-2xs">
                <Check className="w-3 h-3" /> Binary found and working
              </p>
            )}
            {binaryStatus && binaryStatus !== 'valid' && binaryStatus !== 'error' && !checkingBinary && (
              <p className="text-xs text-danger flex items-center gap-2xs">
                <AlertCircle className="w-3 h-3" /> Invalid binary — {binaryStatus === 'no_internal' ? 'missing _internal folder' : binaryStatus === 'no_executable' ? 'no executable found' : binaryStatus === 'no_folder' ? 'folder not found' : binaryStatus === 'folder_permission' ? 'permission denied' : binaryStatus === 'folder_unreadable' ? 'folder could not be read' : binaryStatus}
              </p>
            )}
            {binaryStatus === 'error' && (
              <p className="text-xs text-danger">Failed to check binary</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
