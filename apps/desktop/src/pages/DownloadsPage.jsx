import { useState, useEffect } from 'react';
import { Download, CheckCircle, AlertCircle, Play, Trash2, Loader2, FolderOpen, StopCircle, X } from 'lucide-react';
import LoadingScreen from '../components/LoadingScreen';
import { useDownloads } from '../hooks/useDownloads';
import LocalPlayer from '../components/LocalPlayer';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function DownloadsPage({ activeProfile }) {
  const profileId = activeProfile?.id || 'master-id';
  const { downloads, setDownloads, loading, error, startDownload, cancelDownload, deleteDownload, playDownload, refreshDownloads, stopAllDownloads } = useDownloads(profileId);
  const [retryCount, setRetryCount] = useState(0);
  const [playingDownload, setPlayingDownload] = useState(null);
  const [confirmStopId, setConfirmStopId] = useState(null);

  useEffect(() => {
    refreshDownloads();
  }, [retryCount, profileId]);

  const handlePlay = async (download) => {
    const result = await playDownload(download.id);
    if (result?.success && result.filePath) {
      setPlayingDownload({ filePath: result.filePath, title: download.title });
    }
  };

  const handleDelete = async (id) => {
    await deleteDownload(id);
  };

  const handleOpenFolder = async (download) => {
    const target = download.file_path || download.download_path;
    if (target) {
      await window.electron?.downloads?.showInFolder(target);
    }
  };

  const handleStop = (id) => setConfirmStopId(id);

  const confirmStop = async (id) => {
    await cancelDownload(id);
    setConfirmStopId(null);
  };

  const cancelStop = () => setConfirmStopId(null);

  const handleRetry = async (download) => {
    const result = await startDownload({
      mediaId: download.media_id,
      title: download.title,
      type: download.type,
      quality: 'best',
      tmdbId: download.tmdb_id,
      season: download.type === 'tv' ? download.season : undefined,
      episode: download.type === 'tv' ? download.episode : undefined,
      episodeTitle: download.type === 'tv' ? download.episode_name : undefined,
      sourceId: download.source_id,
      binaryPath: null,
    });

    if (!result?.success) {
      console.error('Retry failed:', result?.error);
    }
  };

  const handleStopAll = () => setConfirmStopId('all');

  const confirmStopAll = async () => {
    await stopAllDownloads();
    setConfirmStopId(null);
  };

  if (loading) {
    return <LoadingScreen message="Loading downloads..." />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-xl text-center">
        <span className="text-4xl mb-md"></span>
        <h2 className="text-lg font-bold text-text-primary mb-sm">Failed to load downloads</h2>
        <p className="text-sm text-text-muted mb-lg max-w-sm">{error}</p>
        <button onClick={() => setRetryCount((c) => c + 1)} className="btn-primary">
          Retry
        </button>
      </div>
    );
  }

  const activeDownloads = downloads.filter((d) => d.status === 'downloading');
  const completedDownloads = downloads.filter((d) => d.status === 'completed');
  const failedDownloads = downloads.filter((d) => d.status === 'failed' || d.status === 'error' || d.status === 'cancelled');

  const hasAnyContent = activeDownloads.length > 0 || completedDownloads.length > 0 || failedDownloads.length > 0;

  return (
    <div className="px-lg py-lg">
      <div className="flex items-center justify-between mb-lg">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Downloads</h1>
          {hasAnyContent && (
            <p className="text-sm text-text-muted mt-xs">
              {activeDownloads.length > 0 && `${activeDownloads.length} active`}
              {failedDownloads.length > 0 && `${activeDownloads.length > 0 ? ', ' : ''}${failedDownloads.length} failed`}
              {completedDownloads.length > 0 && `${(activeDownloads.length > 0 || failedDownloads.length > 0) ? ', ' : ''}${completedDownloads.length} completed`}
            </p>
          )}
        </div>
        {hasAnyContent && (
          <div className="flex items-center gap-sm">
            {activeDownloads.length > 0 && (
              <button
                onClick={handleStopAll}
                className="flex items-center gap-xs text-sm px-md py-sm bg-danger/10 text-danger hover:bg-danger/20 rounded-md transition-colors"
              >
                <StopCircle className="w-4 h-4" />
                Stop All
              </button>
            )}
            <button
              onClick={() => refreshDownloads()}
              className="flex items-center gap-xs text-sm px-md py-sm bg-surface text-text-muted hover:text-accent hover:bg-surface/80 rounded-md border border-border transition-colors"
            >
              <Loader2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {confirmStopId === 'all' && (
        <div className="mb-lg p-md bg-danger/10 border border-danger/30 rounded-card flex items-center justify-between">
          <div className="flex items-center gap-sm">
            <AlertCircle className="w-5 h-5 text-danger" />
            <div>
              <p className="text-sm font-medium text-danger">Stop all active downloads?</p>
              <p className="text-xs text-text-muted mt-xs">All partial files will be deleted.</p>
            </div>
          </div>
          <div className="flex items-center gap-sm">
            <button onClick={cancelStop} className="text-sm px-md py-sm bg-surface border border-border rounded-md text-text-primary hover:bg-surface/80 transition-colors">
              Cancel
            </button>
            <button onClick={confirmStopAll} className="text-sm px-md py-sm bg-danger text-white rounded-md hover:bg-danger/80 transition-colors">
              Stop All
            </button>
          </div>
        </div>
      )}

      {!hasAnyContent ? (
        <div className="flex flex-col items-center w-full text-center py-xl text-text-muted">
          <Download className="w-12 h-12 mb-md" />
          <p className="text-lg">No downloads yet</p>
          <p className="text-sm mt-sm">Download movies and shows to watch offline</p>
        </div>
      ) : (
        <div className="space-y-xl">
          {activeDownloads.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wide mb-md flex items-center gap-sm">
                <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                In Progress
              </h2>
              <div className="space-y-md">
                {activeDownloads.map((download) => (
                  <div key={download.id} className="relative">
                    {confirmStopId === download.id && (
                      <div className="absolute inset-0 z-10 bg-surface/90 rounded-card flex items-center justify-center border border-danger/30">
                        <div className="text-center">
                          <p className="text-sm font-medium text-text-primary mb-xs">Stop this download?</p>
                          <p className="text-xs text-text-muted mb-md">All downloaded files will be deleted.</p>
                          <div className="flex items-center justify-center gap-sm">
                            <button onClick={cancelStop} className="text-sm px-md py-sm bg-surface border border-border rounded-md text-text-primary hover:bg-surface/80 transition-colors">
                              Cancel
                            </button>
                            <button onClick={() => confirmStop(download.id)} className="text-sm px-md py-sm bg-danger text-white rounded-md hover:bg-danger/80 transition-colors">
                              Stop
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-md p-md bg-surface rounded-card border border-border hover:border-accent/30 transition-colors">
                      <div className="w-16 h-24 rounded-card overflow-hidden flex-shrink-0 bg-surface/50">
                        <img
                          src={
                            download.poster_path
                              ? `https://image.tmdb.org/t/p/w92${download.poster_path}`
                              : 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="96" fill="%2312121A"></svg>'
                          }
                          alt={download.title}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-text-primary truncate">
                          {download.title}
                          {download.season && download.episode && (
                            <span className="text-text-muted ml-sm">S{download.season}E{download.episode}</span>
                          )}
                        </h3>
                        <p className="text-xs text-text-muted mt-xs mb-sm">
                          {download.lastMessage || 'Downloading...'}
                          {download.totalFragments > 0 && ` (${download.completedFragments}/${download.totalFragments})`}
                        </p>

                        <div className="w-full bg-background rounded-full h-1.5 mb-sm">
                          <div
                            className="bg-accent h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(download.progress || 0, 100).toFixed(1)}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-xs text-text-muted">
                          <div className="flex items-center gap-lg">
                            <span className="font-medium">{(download.progress || 0).toFixed(1)}%</span>
                            {download.totalFragments > 0 && (
                              <span>{download.completedFragments}/{download.totalFragments}</span>
                            )}
                          </div>
                          <div className="flex gap-md">
                            {download.speed && <span className="text-accent">{download.speed}</span>}
                            {download.size && <span>{download.size}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-xs">
                        <button
                          onClick={() => handleStop(download.id)}
                          className="p-sm text-text-muted hover:text-danger hover:bg-danger/10 rounded-md transition-colors"
                          title="Stop"
                        >
                          <StopCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {failedDownloads.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wide mb-md flex items-center gap-sm">
                <div className="w-2 h-2 rounded-full bg-danger" />
                Failed
              </h2>
              <div className="space-y-md">
                {failedDownloads.map((download) => (
                  <div
                    key={download.id}
                    className="flex items-center gap-md p-md bg-surface rounded-card border border-danger/20 hover:border-danger/40 transition-colors"
                  >
                    <div className="w-16 h-24 rounded-card overflow-hidden flex-shrink-0 bg-surface/50">
                      <img
                        src={
                          download.poster_path
                            ? `https://image.tmdb.org/t/p/w92${download.poster_path}`
                            : 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="96" fill="%2312121A"></svg>'
                        }
                        alt={download.title}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-text-primary truncate">
                        {download.title}
                        {download.season && download.episode && (
                          <span className="text-text-muted ml-sm">S{download.season}E{download.episode}</span>
                        )}
                      </h3>
                      <p className={`text-xs mt-xs ${download.status === 'cancelled' ? 'text-warning' : 'text-danger'}`}>
                        {download.status === 'cancelled'
                          ? 'Stopped'
                          : download.lastMessage || download.error || 'Download failed'}
                      </p>
                    </div>

                    <div className="flex items-center gap-xs">
                      <button
                        onClick={() => handleRetry(download)}
                        className="p-sm text-text-muted hover:text-success hover:bg-success/10 rounded-md transition-colors"
                        title="Retry"
                      >
                        <Loader2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(download.id)}
                        className="p-sm text-text-muted hover:text-danger hover:bg-danger/10 rounded-md transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {completedDownloads.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wide mb-md flex items-center gap-sm">
                <div className="w-2 h-2 rounded-full bg-success" />
                Completed
              </h2>
              <div className="space-y-md">
                {completedDownloads.map((download) => (
                  <div
                    key={download.id}
                    className="flex items-center gap-md p-md bg-surface rounded-card border border-success/20 hover:border-success/40 transition-colors"
                  >
                    <div className="w-16 h-24 rounded-card overflow-hidden flex-shrink-0 bg-surface/50">
                      <img
                        src={
                          download.poster_path
                            ? `https://image.tmdb.org/t/p/w92${download.poster_path}`
                            : 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="96" fill="%2312121A"></svg>'
                        }
                        alt={download.title}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-text-primary truncate">
                        {download.title}
                        {download.season && download.episode && (
                          <span className="text-text-muted ml-sm">S{download.season}E{download.episode}</span>
                        )}
                      </h3>
                      <p className="text-xs text-text-muted mt-xs">
                        {download.size || 'Unknown size'}
                      </p>
                      <p className="text-xs text-success mt-xs flex items-center gap-2xs">
                        <CheckCircle className="w-3 h-3" />
                        Downloaded
                      </p>
                    </div>

                    <div className="flex items-center gap-xs">
                      <button
                        onClick={() => handlePlay(download)}
                        className="btn-primary text-sm flex items-center gap-xs"
                      >
                        <Play className="w-3.5 h-3.5" />
                        Play
                      </button>
                      <button
                        onClick={() => handleOpenFolder(download)}
                        className="p-sm text-text-muted hover:text-accent hover:bg-accent/10 rounded-md transition-colors"
                        title="Open Folder"
                      >
                        <FolderOpen className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(download.id)}
                        className="p-sm text-text-muted hover:text-danger hover:bg-danger/10 rounded-md transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {playingDownload && (
        <LocalPlayer
          filePath={playingDownload.filePath}
          title={playingDownload.title}
          onClose={() => setPlayingDownload(null)}
        />
      )}
    </div>
  );
}

export default DownloadsPage;
