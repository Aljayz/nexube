import { useState, useEffect } from 'react';
import { Download, FolderOpen, HardDrive, RefreshCw, Check, AlertCircle } from 'lucide-react';

export default function DownloadSettings({ activeProfile, onProfileUpdated }) {
  const [downloadPath, setDownloadPath] = useState(activeProfile?.downloadPath || '');
  const [binaryFolder, setBinaryFolder] = useState(() => {
    try { return localStorage.getItem('nexube-downloader-folder') || ''; } catch { return ''; }
  });
  const [binaryStatus, setBinaryStatus] = useState(null);
  const [checkingBinary, setCheckingBinary] = useState(false);
  const [bundledStatus, setBundledStatus] = useState(null);

  useEffect(() => {
    if (binaryFolder) {
      checkBinary(binaryFolder);
    }
  }, []);

  const handlePickDownloadPath = async () => {
    const folder = await window.electron?.downloads?.pickDownloadPath();
    if (folder) {
      setDownloadPath(folder);
      await window.electron?.profiles?.updateProfile(activeProfile.id, { downloadPath: folder });
      if (onProfileUpdated) onProfileUpdated();
    }
  };

  const handlePickBinary = async () => {
    const folder = await window.electron?.downloads?.pickFolder();
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
      const result = await window.electron?.downloads?.checkDownloader(folder);
      setBinaryStatus(result?.exists ? 'valid' : 'invalid');
    } catch {
      setBinaryStatus('error');
    }
    setCheckingBinary(false);
  };

  const handleCheckBundled = async () => {
    setBundledStatus(null);
    try {
      const result = await window.electron?.downloads?.checkBundledDownloader();
      setBundledStatus(result?.exists ? 'valid' : 'not_found');
    } catch {
      setBundledStatus('error');
    }
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
          The app bundles a video downloader automatically. If you encounter issues, you can manually set a custom binary path.
        </p>

        <div className="bg-background rounded-lg p-md mb-md">
          <div className="flex items-center justify-between mb-sm">
            <span className="text-sm font-medium text-text-primary">Bundled Downloader</span>
            <button
              onClick={handleCheckBundled}
              className="text-xs text-accent hover:underline"
            >
              Check status
            </button>
          </div>
          {bundledStatus === null ? (
            <p className="text-xs text-text-muted">Click "Check status" to verify</p>
          ) : bundledStatus === 'valid' ? (
            <p className="text-xs text-success flex items-center gap-2xs">
              <Check className="w-3 h-3" /> Bundled downloader is available
            </p>
          ) : bundledStatus === 'not_found' ? (
            <p className="text-xs text-danger flex items-center gap-2xs">
              <AlertCircle className="w-3 h-3" /> Bundled downloader not found
            </p>
          ) : (
            <p className="text-xs text-danger">Failed to check</p>
          )}
        </div>

        <div className="border-t border-border pt-md">
          <div className="flex items-center justify-between mb-sm">
            <span className="text-sm font-medium text-text-primary">Custom Binary Path</span>
            {binaryFolder && (
              <button
                onClick={handleResetBinary}
                className="text-xs text-text-muted hover:text-danger transition-colors"
              >
                Reset to bundled
              </button>
            )}
          </div>
          <div className="flex items-center gap-sm mb-sm">
            <div className="flex-1 px-sm py-sm bg-background border border-border rounded text-sm text-text-muted font-mono truncate">
              {binaryFolder || <span className="text-text-muted/50">Using bundled downloader</span>}
            </div>
            <button
              onClick={handlePickBinary}
              className="flex items-center gap-xs px-md py-sm bg-surface border border-border text-text-primary rounded-md hover:bg-surface/80 transition-colors text-sm"
            >
              <FolderOpen className="w-4 h-4" />
              Browse
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
          {binaryStatus === 'invalid' && (
            <p className="text-xs text-danger flex items-center gap-2xs">
              <AlertCircle className="w-3 h-3" /> Invalid binary — missing _internal folder or executable
            </p>
          )}
          {binaryStatus === 'error' && (
            <p className="text-xs text-danger">Failed to check binary</p>
          )}
        </div>
      </div>
    </div>
  );
}