import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Download, CheckCircle, AlertCircle, Loader2, Film, Tv, FolderOpen, Settings } from 'lucide-react';
import { PLAYER_SOURCES } from '@nexube/player-engine';
import { useDownloads } from '../hooks/useDownloads';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
}

function DownloadModal({ media, activeProfile, sourceId, onClose, isAnime, onProfileUpdated, relatedMovies }) {
  const profileId = activeProfile?.id || 'master-id';
  const { downloads, startDownload, startBatchDownload } = useDownloads(profileId);
  const [downloading, setDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState(null);
  const [error, setError] = useState(null);
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  const [episodes, setEpisodes] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [downloaderFolder, setDownloaderFolder] = useState(() => {
    try {
      return localStorage.getItem('nexube-downloader-folder') || '';
    } catch {
      return '';
    }
  });
  const [downloader, setDownloader] = useState(null);
  const [checking, setChecking] = useState(true);
  const [usingBundled, setUsingBundled] = useState(false);
  const [downloadPath, setDownloadPath] = useState(activeProfile?.downloadPath || '');
  const [defaultDownloadPath, setDefaultDownloadPath] = useState('');
  const [settingPath, setSettingPath] = useState(false);

  useEffect(() => {
    window.electron?.deskDownloads?.defaultPath().then(setDefaultDownloadPath);
  }, []);
  const [selectedSource, setSelectedSource] = useState(sourceId || 'videasy');
  const [translationType, setTranslationType] = useState('sub');
  const [batchQueued, setBatchQueued] = useState(false);
  const [selectedEpisodes, setSelectedEpisodes] = useState(new Set());
  const [selectedCollectionItems, setSelectedCollectionItems] = useState(new Set());
  const abortRef = useRef(false);

  useEffect(() => {
    if (episodes.length > 0) {
      setSelectedEpisodes(new Set(episodes.map((ep) => ep.episode_number)));
    }
  }, [episodes]);

  useEffect(() => {
    if (relatedMovies?.length > 0) {
      setSelectedCollectionItems(new Set([media.id, ...relatedMovies.map((m) => m.id)]));
    } else {
      setSelectedCollectionItems(new Set());
    }
  }, [relatedMovies]);

  useEffect(() => {
    if (media?.type === 'tv') {
      fetchSeasons();
    }
  }, [media]);

  useEffect(() => {
    let mounted = true;
    setChecking(true);

    window.electron?.deskDownloads?.checkBundled().then((result) => {
      if (!mounted) return;
      if (result.exists) {
        setDownloader(result);
        setUsingBundled(true);
        setChecking(false);
        return;
      }

      if (downloaderFolder) {
        window.electron?.deskDownloads?.checkFolder(downloaderFolder).then((manualResult) => {
          if (!mounted) return;
          setDownloader(manualResult);
          setUsingBundled(false);
          setChecking(false);
        });
      } else {
        setUsingBundled(false);
        setChecking(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, [downloaderFolder]);

  useEffect(() => {
    if (downloadStatus?.id) {
      const existing = downloads.find((d) => d.id === downloadStatus.id);
      if (existing) {
        if (existing.status === 'completed') {
          setDownloading(false);
        } else if (existing.status === 'failed' || existing.status === 'error') {
          setDownloading(false);
          setError(existing.error || 'Download failed');
        }
      }
    }
  }, [downloads, downloadStatus]);

  async function fetchSeasons() {
    try {
      const details = await window.electron?.tmdb?.fetch(`/tv/${media.tmdbId}`);
      if (details?.seasons) {
        const filtered = details.seasons.filter((s) => s.season_number > 0);
        setSeasons(filtered);
        if (filtered.length > 0) {
          setSeason(filtered[0].season_number);
          fetchEpisodes(filtered[0].season_number);
        }
      }
    } catch (err) {
      console.error('Failed to fetch seasons:', err);
    }
  }

  async function fetchEpisodes(seasonNumber) {
    try {
      const res = await window.electron?.tmdb?.fetch(`/tv/${media.tmdbId}/season/${seasonNumber}`);
      if (res?.episodes) {
        setEpisodes(res.episodes);
        setEpisode(1);
      }
    } catch (err) {
      console.error('Failed to fetch episodes:', err);
    }
  }

  const pickBinaryFolder = async () => {
    const folder = await window.electron?.deskDownloads?.pickFolder(downloaderFolder);
    if (folder) {
      setDownloaderFolder(folder);
      try {
        localStorage.setItem('nexube-downloader-folder', folder);
      } catch {}
    }
  };

  const pickDownloadFolder = async () => {
    const folder = await window.electron?.deskDownloads?.pickFolder(downloadPath);
    if (folder) {
      setDownloadPath(folder);
      await window.electron?.profiles?.updateProfile(activeProfile.id, { downloadPath: folder });
      onProfileUpdated?.();
      setSettingPath(false);
    }
  };

  const handleDownload = async () => {
    if (!downloader?.exists) return;
    if (!downloadPath) {
      setSettingPath(true);
      return;
    }

    setDownloading(true);
    setError(null);
    abortRef.current = false;

    const currentEp = media.type === 'tv' ? episodes.find((ep) => ep.episode_number === episode) : null;
    const episodeTitle = currentEp?.name || null;

    const result = await startDownload({
      mediaId: media.id,
      title: media.title,
      type: media.type,
      quality: 'best',
      tmdbId: media.tmdbId,
      season: media.type === 'tv' ? season : undefined,
      episode: media.type === 'tv' ? episode : undefined,
      episodeTitle: media.type === 'tv' ? episodeTitle : undefined,
      sourceId: selectedSource,
      binaryToken: usingBundled ? null : downloader.token,
      downloadPath,
      translationType: selectedSource === 'allmanga' ? translationType : undefined,
    });

    if (result?.success) {
      setDownloadStatus({ id: result.downloadId || result.id });
    } else {
      setDownloading(false);
      setError(result?.error || 'Failed to start download');
    }
  };

  const handleClose = () => {
    abortRef.current = true;
    onClose();
  };

  const toggleEpisode = (epNum) => {
    setSelectedEpisodes((prev) => {
      const next = new Set(prev);
      if (next.has(epNum)) next.delete(epNum); else next.add(epNum);
      return next;
    });
  };

  const toggleAllEpisodes = (select) => {
    if (select) {
      setSelectedEpisodes(new Set(episodes.map((ep) => ep.episode_number)));
    } else {
      setSelectedEpisodes(new Set());
    }
  };

  const toggleCollectionItem = (id) => {
    setSelectedCollectionItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAllCollectionItems = (select) => {
    if (select) {
      setSelectedCollectionItems(new Set([media.id, ...(relatedMovies || []).map((m) => m.id)]));
    } else {
      setSelectedCollectionItems(new Set());
    }
  };

  const handleBatchDownload = async (batchType) => {
    if (!downloader?.exists) return;
    if (!downloadPath) {
      setSettingPath(true);
      return;
    }

    let collectionId;
    let payload;

    if (batchType === 'collection') {
      try {
        const details = await window.electron?.tmdb?.fetch(`/movie/${media.tmdbId}`);
        collectionId = details?.belongs_to_collection?.id;
      } catch {}

      const currentItem = { mediaId: media.id, title: media.title, tmdbId: media.tmdbId };
      const otherItems = (relatedMovies || [])
        .filter((m) => selectedCollectionItems.has(m.id))
        .map((m) => ({ mediaId: m.id, title: m.title, tmdbId: m.tmdbId }));
      payload = {
        type: 'collection',
        mediaId: media.id,
        title: media.title,
        tmdbId: media.tmdbId,
        collectionId,
        items: [currentItem, ...otherItems],
        sourceId: selectedSource,
        binaryToken: usingBundled ? null : downloader.token,
        downloadPath,
        translationType: selectedSource === 'allmanga' ? translationType : undefined,
      };
    } else {
      const selectedEpData = episodes
        .filter((ep) => selectedEpisodes.has(ep.episode_number))
        .map((ep) => ({ episode: ep.episode_number, episodeTitle: ep.name }));
      payload = {
        type: 'season',
        mediaId: media.id,
        title: media.title,
        tmdbId: media.tmdbId,
        season,
        episodes: selectedEpData,
        sourceId: selectedSource,
        binaryToken: usingBundled ? null : downloader.token,
        downloadPath,
        translationType: selectedSource === 'allmanga' ? translationType : undefined,
      };
    }

    const result = await startBatchDownload(payload);
    if (result?.success) {
      setBatchQueued(true);
      setTimeout(() => onClose(), 2000);
    } else {
      setError(result?.error || 'Failed to queue batch');
    }
  };

  const activeDownload = downloadStatus?.id
    ? downloads.find((d) => d.id === downloadStatus.id)
    : null;

  // ── No download path set ───────────────────────────────────────────────
  if (!downloadPath || settingPath) {
    return (
      <div className="fixed inset-0 bg-overlay backdrop-blur-overlay z-50 flex items-center justify-center p-xl" onClick={handleClose}>
        <div className="relative w-full max-w-md bg-surface rounded-xl overflow-hidden shadow-xl border border-border" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-lg py-md border-b border-border">
            <div className="flex items-center gap-sm">
              <FolderOpen className="w-5 h-5 text-accent" />
              <h3 className="text-lg font-bold text-text-primary">Set Download Folder</h3>
            </div>
            <button onClick={handleClose} className="text-text-muted hover:text-text-primary transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-lg">
            <p className="text-sm text-text-muted mb-lg">
              {settingPath ? 'Choose where downloaded videos should be saved:' : (
                <>
                  <span className="text-danger font-semibold">No download folder set.</span>
                  <br />
                  Choose where to save downloaded videos:
                </>
              )}
            </p>

            <div className="flex gap-sm mb-lg">
              <input
                className="flex-1 px-sm py-sm bg-background border border-border rounded text-sm text-text-primary"
                placeholder={defaultDownloadPath || '/home/you/Videos/Nexube'}
                value={downloadPath}
                onChange={(e) => setDownloadPath(e.target.value)}
              />
              <button
                className="btn-secondary px-md py-sm text-sm"
                onClick={pickDownloadFolder}
              >
                Browse
              </button>
            </div>

            <div className="flex gap-sm">
              <button
                className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!downloadPath.trim()}
                onClick={async () => {
                  await window.electron?.profiles?.updateProfile(activeProfile.id, { downloadPath: downloadPath.trim() });
                  onProfileUpdated?.();
                  setSettingPath(false);
                }}
              >
                Confirm
              </button>
              {settingPath && (
                <button className="btn-secondary" onClick={() => setSettingPath(false)}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main modal ─────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-overlay backdrop-blur-overlay z-50 flex items-center justify-center p-xl" onClick={handleClose}>
      <div className="relative w-full max-w-lg bg-surface rounded-xl overflow-hidden shadow-xl border border-border" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-lg py-md border-b border-border">
          <div className="flex items-center gap-sm">
            <Download className="w-5 h-5 text-accent" />
            <h3 className="text-lg font-bold text-text-primary">Download</h3>
          </div>
          <button onClick={handleClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-lg">
          <div className="flex gap-md mb-lg">
            <img
              src={
                media.posterPath
                  ? `https://image.tmdb.org/t/p/w185${media.posterPath}`
                  : 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="150" fill="%2312121A"></svg>'
              }
              alt={media.title}
              className="w-24 h-36 object-cover rounded-card"
            />
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-text-primary mb-sm">{media.title}</h4>
              <div className="flex items-center gap-sm text-sm text-text-muted">
                {media.type === 'movie' ? (
                  <Film className="w-4 h-4" />
                ) : (
                  <Tv className="w-4 h-4" />
                )}
                <span>{media.type === 'movie' ? 'Movie' : 'TV Series'}</span>
              </div>
              {media.releaseDate && (
                <p className="text-sm text-text-muted mt-xs">{new Date(media.releaseDate).getFullYear()}</p>
              )}
            </div>
          </div>

          {media.type === 'tv' && seasons.length > 0 && (
            <div className="mb-lg">
              <label className="text-sm font-medium text-text-primary mb-sm block">Episode</label>
              <div className="flex gap-sm">
                <select
                  value={season}
                  onChange={(e) => {
                    const s = parseInt(e.target.value, 10);
                    setSeason(s);
                    fetchEpisodes(s);
                  }}
                  className="flex-1 px-sm py-sm bg-background border border-border rounded text-sm text-text-primary"
                >
                  {seasons.map((s) => (
                    <option key={s.season_number} value={s.season_number}>
                      Season {s.season_number}
                    </option>
                  ))}
                </select>
                <select
                  value={episode}
                  onChange={(e) => setEpisode(parseInt(e.target.value, 10))}
                  className="flex-1 px-sm py-sm bg-background border border-border rounded text-sm text-text-primary"
                >
                  {episodes.map((ep) => (
                    <option key={ep.episode_number} value={ep.episode_number}>
                      E{ep.episode_number} - {ep.name?.length > 25 ? ep.name.slice(0, 25) + '...' : ep.name || `Episode ${ep.episode_number}`}
                    </option>
                  ))}
                </select>
              </div>
              {media.type === 'tv' && episodes.length > 0 && (
                <div className="mt-md">
                  <div className="flex items-center justify-between mb-sm">
                    <span className="text-xs font-medium text-text-muted">Select episodes</span>
                    <div className="flex gap-sm">
                      <button onClick={() => toggleAllEpisodes(true)} className="text-xs text-accent hover:underline">All</button>
                      <button onClick={() => toggleAllEpisodes(false)} className="text-xs text-text-muted hover:text-text-primary">None</button>
                    </div>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {episodes.map((ep) => (
                      <label key={ep.episode_number} className="flex items-center gap-sm px-sm py-2xs hover:bg-surface-hover rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedEpisodes.has(ep.episode_number)}
                          onChange={() => toggleEpisode(ep.episode_number)}
                          className="accent-accent"
                        />
                        <span className="text-xs text-text-primary truncate">
                          E{ep.episode_number} - {ep.name || `Episode ${ep.episode_number}`}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mb-lg">
            <label className="text-sm font-medium text-text-primary mb-sm block">Source</label>
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="w-full px-sm py-sm bg-background border border-border rounded text-sm text-text-primary"
            >
              {PLAYER_SOURCES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}{s.tag ? ` (${s.tag})` : ''}
                </option>
              ))}
            </select>
          </div>

          {selectedSource === 'vidsrc' && (
            <div className="mb-lg p-md bg-background border border-border rounded-card">
              <p className="text-sm text-text-muted flex items-center gap-sm">
                <AlertCircle className="w-8 h-8 flex-shrink-0 text-accent" />
                Quick download is not supported for VidSrc. Open the player and click the download button there.
              </p>
            </div>
          )}

          {selectedSource === 'allmanga' && !isAnime && (
            <div className="mb-lg p-md bg-background border border-border rounded-card">
              <p className="text-sm text-text-muted flex items-center gap-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-accent" />
                AllManga is only available for anime content.
              </p>
            </div>
          )}

          {selectedSource === 'allmanga' && isAnime && (
            <div className="mb-lg">
              <label className="text-sm font-medium text-text-primary mb-sm block">Audio</label>
              <div className="flex gap-sm">
                <button
                  onClick={() => setTranslationType('sub')}
                  className={`flex-1 px-md py-sm rounded-button text-sm font-medium transition-colors ${
                    translationType === 'sub'
                      ? 'bg-accent text-background'
                      : 'bg-surface-hover text-text-primary hover:bg-border'
                  }`}
                >
                  SUB
                </button>
                <button
                  onClick={() => setTranslationType('dub')}
                  className={`flex-1 px-md py-sm rounded-button text-sm font-medium transition-colors ${
                    translationType === 'dub'
                      ? 'bg-accent text-background'
                      : 'bg-surface-hover text-text-primary hover:bg-border'
                  }`}
                >
                  DUB
                </button>
              </div>
            </div>
          )}

          {media.type === 'movie' && relatedMovies?.length > 0 && (
            <div className="mb-lg">
              <div className="flex items-center justify-between mb-sm">
                <span className="text-xs font-medium text-text-muted">Select movies in collection</span>
                <div className="flex gap-sm">
                  <button onClick={() => toggleAllCollectionItems(true)} className="text-xs text-accent hover:underline">All</button>
                  <button onClick={() => toggleAllCollectionItems(false)} className="text-xs text-text-muted hover:text-text-primary">None</button>
                </div>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                <label className="flex items-center gap-sm px-sm py-2xs bg-surface-hover rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedCollectionItems.has(media.id)}
                    onChange={() => toggleCollectionItem(media.id)}
                    className="accent-accent"
                  />
                  <span className="text-xs text-text-primary font-medium truncate">{media.title}</span>
                  <span className="text-xs text-text-muted flex-shrink-0">(current)</span>
                </label>
                {relatedMovies.map((m) => (
                  <label key={m.id} className="flex items-center gap-sm px-sm py-2xs hover:bg-surface-hover rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCollectionItems.has(m.id)}
                      onChange={() => toggleCollectionItem(m.id)}
                      className="accent-accent"
                    />
                    <span className="text-xs text-text-primary truncate">{m.title}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* ── Downloader setup ──────────────────────────────────────── */}
          {!downloader?.exists && !usingBundled && (
            <div className="mb-lg p-md bg-background border border-border rounded-card">
              <h4 className="text-sm font-semibold text-text-primary mb-sm">Select Downloader Folder</h4>
              <p className="text-sm text-text-muted mb-md">
                Bundled downloader not found. Select a folder containing a compatible downloader binary (must contain <code className="px-xs py-2xs bg-surface rounded text-xs">_internal</code>).
              </p>

              <div className="flex items-center gap-sm">
                <button className="btn-secondary text-sm flex items-center gap-sm" onClick={pickBinaryFolder}>
                  <FolderOpen className="w-4 h-4" />
                  Choose folder
                </button>
                {downloaderFolder && (
                  <span className="text-xs text-text-muted truncate">{downloaderFolder}</span>
                )}
              </div>

              {checking && (
                <div className="flex items-center gap-sm mt-sm text-sm text-text-muted">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Checking…
                </div>
              )}

              {!checking && downloader && !downloader.exists && downloaderFolder && (
                <div className="mt-sm text-sm text-danger">
                  {downloader.reason === 'folder_permission' && 'Permission denied.'}
                  {downloader.reason === 'folder_unreadable' && 'Folder could not be read.'}
                  {downloader.reason === 'no_internal' && (
                    <>Missing <code className="px-xs py-2xs bg-surface rounded text-xs">_internal</code> folder.</>
                  )}
                  {(!downloader.reason || downloader.reason === 'no_executable') && (
                    <>No executable found in the selected folder.</>
                  )}
                </div>
              )}
            </div>
          )}

          {checking && (
            <div className="mb-lg flex items-center gap-sm text-sm text-text-muted">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Checking for bundled downloader…
            </div>
          )}

          {downloader?.exists && (
            <div className="mb-lg">
              <div className="flex items-center gap-sm mb-sm">
                <CheckCircle className="w-4 h-4 text-success" />
                <span className="text-sm text-success font-medium">
                  {usingBundled ? 'Video Downloader ready (bundled)' : 'Video Downloader found'}
                </span>
              </div>
              <div className="flex items-center gap-sm mb-md">
                <span className="text-xs text-text-muted">Save to:</span>
                <code className="text-xs text-text-muted truncate">{downloadPath}</code>
                <button className="text-xs text-accent hover:underline" onClick={() => setSettingPath(true)}>
                  Change
                </button>
              </div>
            </div>
          )}

          {downloading && activeDownload && (
            <div className="mb-lg">
              <div className="flex items-center justify-between mb-sm">
                <span className="text-sm text-text-muted flex items-center gap-sm">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {activeDownload.lastMessage || 'Downloading...'}
                </span>
                <span className="text-sm text-accent">{(activeDownload.progress || 0).toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-background rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-300"
                    style={{ width: `${Math.min(activeDownload.progress || 0, 100).toFixed(1)}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="mb-lg p-sm bg-danger/10 border border-danger/30 rounded text-sm text-danger flex items-center gap-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {activeDownload?.status === 'completed' && (
            <div className="mb-lg p-sm bg-success/10 border border-success/30 rounded text-sm text-success flex items-center gap-sm">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>Download complete!</span>
            </div>
          )}

          {batchQueued && (
            <div className="mb-lg p-sm bg-success/10 border border-success/30 rounded text-sm text-success flex items-center gap-sm">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>Added to queue! Track progress in Downloads.</span>
            </div>
          )}

          {!checking && downloader?.exists && downloadStatus !== 'ok' && selectedSource !== 'vidsrc' && !(selectedSource === 'allmanga' && !isAnime) && !batchQueued && (
            <div className="flex gap-sm">
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-sm"
              >
                {downloading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Downloading…
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    {media.type === 'tv' ? `Download S${season}E${episode}` : 'Download'}
                  </>
                )}
              </button>

              {media.type === 'tv' && episodes.length > 0 && selectedEpisodes.size > 0 && (
                <button
                  onClick={() => handleBatchDownload('season')}
                  className="btn-secondary flex items-center justify-center gap-sm text-sm whitespace-nowrap"
                >
                  <Download className="w-4 h-4" />
                  {selectedEpisodes.size === episodes.length ? `Season ${season}` : `${selectedEpisodes.size} selected`}
                </button>
              )}

              {media.type === 'movie' && relatedMovies?.length > 0 && selectedCollectionItems.size > 1 && (
                <button
                  onClick={() => handleBatchDownload('collection')}
                  className="btn-secondary flex items-center justify-center gap-sm text-sm whitespace-nowrap"
                >
                  <Download className="w-4 h-4" />
                  {selectedCollectionItems.size === relatedMovies.length + 1 ? 'Collection' : `${selectedCollectionItems.size} selected`}
                </button>
              )}
            </div>
          )}

          {downloadStatus === 'ok' && (
            <div className="text-center">
              <div className="text-success font-medium mb-sm">Download started!</div>
              <button className="btn-secondary text-sm" onClick={handleClose}>
                Close — track progress in Downloads
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DownloadModal;
