import { useState, useEffect, useMemo } from 'react';
import { Download, CheckCircle, AlertCircle, Play, Trash2, Loader2, FolderOpen, StopCircle, PauseCircle, X, Search, Film, Tv } from 'lucide-react';
import LoadingScreen from '../components/LoadingScreen';
import { useDownloads } from '../hooks/useDownloads';
import LocalPlayer from '../components/LocalPlayer';
import OfflineDetailView from '../components/OfflineDetailView';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
}

function DownloadsPage({ activeProfile }) {
  const profileId = activeProfile?.id || 'master-id';
  const { downloads, setDownloads, loading, error, startDownload, cancelDownload, pauseDownload, resumeDownload, deleteDownload, playDownload, refreshDownloads, stopAllDownloads } = useDownloads(profileId);
  const [retryCount, setRetryCount] = useState(0);
  const [playingDownload, setPlayingDownload] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [offlineDetail, setOfflineDetail] = useState(null);

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
      await window.electron?.deskDownloads?.showInFolder(target);
    }
  };

  const handleStop = async (id) => {
    await cancelDownload(id);
  };

  const handlePause = async (id) => {
    await pauseDownload(id);
  };

  const handleResume = async (id) => {
    await resumeDownload(id);
  };

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
      binaryToken: null,
    });

    if (!result?.success) {
      console.error('Retry failed:', result?.error);
    }
  };

  const handleStopAll = async () => {
    await stopAllDownloads();
  };

  const handleScan = async () => {
    setScanning(true);
    setScanResult(null);
    const downloadPath = activeProfile?.downloadPath || '';
    const result = await window.electron?.deskDownloads?.scan({ profileId, downloadPath });
    if (result) {
      setScanResult(result);
      if (result.imported > 0) refreshDownloads();
    }
    setScanning(false);
  };



  const activeDownloads = downloads.filter((d) => d.status === 'downloading');
  const pausedDownloads = downloads.filter((d) => d.status === 'paused');
  const completedDownloads = downloads.filter((d) => d.status === 'completed');
  const failedDownloads = downloads.filter((d) => ['failed', 'error', 'cancelled', 'stopped', 'killed'].includes(d.status));

  const hasAnyContent = activeDownloads.length > 0 || pausedDownloads.length > 0 || completedDownloads.length > 0 || failedDownloads.length > 0;

  const { movieCards, tvCards } = useMemo(() => {
    const singleMovies = completedDownloads.filter((d) => d.type === 'movie' && d.season == null && d.episode == null);
    const groupable = completedDownloads.filter((d) => d.type === 'tv' || (d.season != null));
    const groups = {};
    groupable.forEach((d) => {
      const key = d.media_id;
      if (!groups[key]) groups[key] = { media_id: key, title: d.title, type: d.type, poster_path: d.poster_path, tmdb_id: d.tmdb_id, items: [] };
      groups[key].items.push(d);
    });
    const tvCards = Object.values(groups).sort((a, b) => {
      const aDate = Math.max(...a.items.map((d) => new Date(d.added_at || 0).getTime()));
      const bDate = Math.max(...b.items.map((d) => new Date(d.added_at || 0).getTime()));
      return bDate - aDate;
    });
    const movieCards = singleMovies.map((d) => ({ media_id: d.media_id, title: d.title, type: d.type, poster_path: d.poster_path, tmdb_id: d.tmdb_id, items: [d] })).sort((a, b) => {
      const aDate = new Date(a.items[0].added_at || 0).getTime();
      const bDate = new Date(b.items[0].added_at || 0).getTime();
      return bDate - aDate;
    });
    return { movieCards, tvCards };
  }, [completedDownloads]);

  return (
    <>
      {offlineDetail ? (
        <div className="h-full">
          <OfflineDetailView
            title={offlineDetail.title}
            type={offlineDetail.type}
            posterPath={offlineDetail.poster_path}
            tmdbId={offlineDetail.tmdb_id}
            items={offlineDetail.items}
            onBack={() => setOfflineDetail(null)}
          />
        </div>
      ) : loading ? (
        <LoadingScreen message="Loading downloads..." />
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-full px-xl text-center">
          <span className="text-4xl mb-md"></span>
          <h2 className="text-lg font-bold text-text-primary mb-sm">Failed to load downloads</h2>
          <p className="text-sm text-text-muted mb-lg max-w-sm">{error}</p>
          <button onClick={() => setRetryCount((c) => c + 1)} className="btn-primary">
            Retry
          </button>
        </div>
      ) : (
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
        <div className="flex items-center gap-sm">
          {hasAnyContent && activeDownloads.length > 0 && (
            <button
              onClick={handleStopAll}
              className="flex items-center gap-xs text-sm px-md py-sm bg-danger/10 text-danger hover:bg-danger/20 rounded-md transition-colors"
            >
              <StopCircle className="w-4 h-4" />
              Stop All
            </button>
          )}
          <button
            onClick={handleScan}
            disabled={scanning}
            className="flex items-center gap-xs text-sm px-md py-sm bg-surface text-text-muted hover:text-accent hover:bg-surface/80 rounded-md border border-border transition-colors disabled:opacity-50"
          >
            {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            Scan
          </button>
          {hasAnyContent && (
            <button
              onClick={() => refreshDownloads()}
              className="flex items-center gap-xs text-sm px-md py-sm bg-surface text-text-muted hover:text-accent hover:bg-surface/80 rounded-md border border-border transition-colors"
            >
              <Loader2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      {scanResult && (
        <div className={`mb-lg p-md rounded-card flex items-center justify-between ${scanResult.imported > 0 ? 'bg-success/10 border border-success/30' : 'bg-background border border-border'}`}>
          <div className="flex items-center gap-sm">
            {scanResult.imported > 0 ? <CheckCircle className="w-5 h-5 text-success" /> : <Search className="w-5 h-5 text-text-muted" />}
            <div>
              <p className="text-sm font-medium text-text-primary">
                {scanResult.imported > 0
                  ? `Found ${scanResult.found} file(s), imported ${scanResult.imported} new`
                  : scanResult.found > 0
                    ? `${scanResult.found} file(s) found, all already tracked`
                    : 'No video files found in download path'}
              </p>
            </div>
          </div>
          <button onClick={() => setScanResult(null)} className="text-text-muted hover:text-text-primary">
            <X className="w-4 h-4" />
          </button>
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
                  <div key={download.id} className="flex items-center gap-md p-md bg-surface rounded-card border border-border hover:border-accent/30 transition-colors">
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
                          {/* <span className="font-medium">{(download.progress || 0).toFixed(1)}%</span>
                          {download.totalFragments > 0 && (
                            <span>{download.completedFragments}/{download.totalFragments}</span>
                          )} */}
                        </div>
                        <div className="flex gap-md">
                          {download.downloaded_bytes ? (
                            <span className="text-accent">{formatBytes(download.downloaded_bytes)} / {formatBytes(download.total_bytes)}</span>
                          ) : null}
                          {/* {download.speed ? <span className="text-accent">{formatBytes(download.speed)}/s</span> : null} */}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-xs">
                      <button
                        onClick={() => handlePause(download.id)}
                        className="p-sm text-text-muted hover:text-warning hover:bg-warning/10 rounded-md transition-colors"
                        title="Pause"
                      >
                        <PauseCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleStop(download.id)}
                        className="p-sm text-text-muted hover:text-danger hover:bg-danger/10 rounded-md transition-colors"
                        title="Stop"
                      >
                        <StopCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pausedDownloads.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wide mb-md flex items-center gap-sm">
                <div className="w-2 h-2 rounded-full bg-warning" />
                Paused
              </h2>
              <div className="space-y-md">
                {pausedDownloads.map((download) => (
                  <div key={download.id} className="flex items-center gap-md p-md bg-surface rounded-card border border-warning/20 hover:border-warning/40 transition-colors">
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
                      <p className="text-xs text-warning mt-xs">
                        Paused at {(download.progress || 0).toFixed(1)}%
                      </p>
                    </div>

                    <div className="flex items-center gap-xs">
                      <button
                        onClick={() => handleResume(download.id)}
                        className="p-sm text-text-muted hover:text-success hover:bg-success/10 rounded-md transition-colors"
                        title="Resume"
                      >
                        <Play className="w-4 h-4" />
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
                      <p className={`text-xs mt-xs ${['cancelled', 'stopped', 'killed'].includes(download.status) ? 'text-warning' : 'text-danger'}`}>
                        {['cancelled', 'stopped', 'killed'].includes(download.status)
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

          {movieCards.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wide mb-md flex items-center gap-sm">
                <Film className="w-4 h-4" />
                Movies
              </h2>
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 2xl:grid-cols-9 gap-sm">
                {movieCards.map((card) => (
                  <div
                    key={card.media_id}
                    className="group cursor-pointer"
                    onClick={() => setOfflineDetail(card)}
                  >
                    <div className="aspect-[2/3] bg-surface rounded-card overflow-hidden mb-2xs relative">
                      {card.poster_path ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w185${card.poster_path}`}
                          alt={card.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Film className="w-8 h-8 text-text-muted" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full bg-accent/90 flex items-center justify-center">
                          <Play className="w-5 h-5 text-background ml-0.5" />
                        </div>
                      </div>
                    </div>
                    <h3 className="text-xs font-medium text-text-primary truncate">{card.title}</h3>
                    <p className="text-xs text-text-muted mt-2xs">Movie</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tvCards.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wide mb-md flex items-center gap-sm">
                <Tv className="w-4 h-4" />
                TV Series
              </h2>
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 2xl:grid-cols-9 gap-sm">
                {tvCards.map((card) => (
                  <div
                    key={card.media_id}
                    className="group cursor-pointer"
                    onClick={() => setOfflineDetail(card)}
                  >
                    <div className="aspect-[2/3] bg-surface rounded-card overflow-hidden mb-2xs relative">
                      {card.poster_path ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w185${card.poster_path}`}
                          alt={card.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Tv className="w-8 h-8 text-text-muted" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full bg-accent/90 flex items-center justify-center">
                          <Play className="w-5 h-5 text-background ml-0.5" />
                        </div>
                      </div>
                    </div>
                    <h3 className="text-xs font-medium text-text-primary truncate">{card.title}</h3>
                    <div className="flex items-center gap-2xs mt-2xs">
                      <span className="text-xs text-text-muted">{card.items.length} ep</span>
                      <span className="text-xs text-accent">
                        S{Math.min(...card.items.map((d) => d.season).filter((s) => s != null))}
                        {[...new Set(card.items.map((d) => d.season).filter((s) => s != null))].length > 1
                          ? `-S${Math.max(...card.items.map((d) => d.season).filter((s) => s != null))}`
                          : ''}
                      </span>
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
      )}
    </>
  );
}

export default DownloadsPage;
