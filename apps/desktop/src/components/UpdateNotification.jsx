import { useState, useEffect, useCallback } from 'react';
import { Download, RotateCw, X } from 'lucide-react';

export default function UpdateNotification() {
  const [status, setStatus] = useState('idle');
  const [updateInfo, setUpdateInfo] = useState(null);
  const [progress, setProgress] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    const checkEnabled = async () => {
      const s = await window.electron?.update?.getStatus?.();
      if (s) setEnabled(s.enabled);
    };
    checkEnabled();
  }, []);

  useEffect(() => {
    const electron = window.electron;
    if (!electron?.update) return;

    const handlers = [
      electron.update.onChecking(() => setStatus('checking')),
      electron.update.onAvailable((info) => {
        setStatus('available');
        setUpdateInfo(info);
        setDismissed(false);
      }),
      electron.update.onNotAvailable(() => setStatus('idle')),
      electron.update.onError(() => setStatus('idle')),
      electron.update.onProgress((p) => {
        setStatus('downloading');
        setProgress(p.percent);
      }),
      electron.update.onDownloaded(() => {
        setStatus('downloaded');
        setProgress(100);
      }),
    ];

    return () => {
      handlers.forEach((h, i) => {
        const channels = ['checking', 'available', 'not-available', 'error', 'progress', 'downloaded'];
        electron.update.removeListener(`update:${channels[i]}`, h);
      });
    };
  }, []);

  const handleDownload = useCallback(async () => {
    await window.electron.update.download();
  }, []);

  const handleInstall = useCallback(async () => {
    await window.electron.update.install();
  }, []);

  if (!enabled || dismissed || status === 'idle' || status === 'checking') return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="bg-[#1A1A24] border border-[#2A2A3A] rounded-xl p-4 shadow-2xl max-w-sm">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {status === 'available' && <Download className="w-5 h-5 text-indigo-400" />}
            {status === 'downloading' && <RotateCw className="w-5 h-5 text-indigo-400 animate-spin" />}
            {status === 'downloaded' && <Download className="w-5 h-5 text-green-400" />}
            <span className="text-sm font-medium text-white">
              {status === 'available' && `Update ${updateInfo?.version} available`}
              {status === 'downloading' && 'Downloading update...'}
              {status === 'downloaded' && 'Update ready to install'}
            </span>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-gray-500 hover:text-gray-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {status === 'downloading' && (
          <div className="w-full bg-[#0A0A0F] rounded-full h-2 mb-3">
            <div
              className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <div className="flex gap-2">
          {status === 'available' && (
            <button
              onClick={handleDownload}
              className="flex-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors"
            >
              Download
            </button>
          )}
          {status === 'downloaded' && (
            <button
              onClick={handleInstall}
              className="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-medium rounded-lg transition-colors"
            >
              Install & Restart
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
