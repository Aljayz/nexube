import { useState, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Play, Download, Film, Tv, Trash2 } from 'lucide-react';
import LocalPlayer from './LocalPlayer';
import OfflineEpisodeGrid from './OfflineEpisodeGrid';

export default function OfflineDetailView({ title, type, posterPath, tmdbId, items, onBack, onRequestDelete, onRequestDeleteAll }) {
  const [currentEpisode, setCurrentEpisode] = useState(null);
  const [posterError, setPosterError] = useState(false);

  const episodes = useMemo(
    () => items
      .filter((d) => d.status === 'completed')
      .sort((a, b) => (a.season || 0) - (b.season || 0) || (a.episode || 0) - (b.episode || 0)),
    [items]
  );

  const currentIndex = useMemo(
    () => episodes.findIndex((e) => e.id === currentEpisode?.id),
    [episodes, currentEpisode]
  );

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < episodes.length - 1;

  const handlePlay = useCallback(async (ep) => {
    try {
      const result = await window.electron?.deskDownloads?.play(ep.id);
      console.log('[OfflineDetailView] play result:', result);
      if (result?.success) {
        setCurrentEpisode({ ...ep, filePath: result.filePath, subtitles: result.subtitles });
      } else {
        console.warn('[OfflineDetailView] play failed:', result?.error);
      }
    } catch (err) {
      console.warn('[OfflineDetailView] play error:', err);
    }
  }, []);

  const handlePrev = useCallback(() => {
    if (hasPrev) handlePlay(episodes[currentIndex - 1]);
  }, [hasPrev, episodes, currentIndex, handlePlay]);

  const handleNext = useCallback(() => {
    if (hasNext) handlePlay(episodes[currentIndex + 1]);
  }, [hasNext, episodes, currentIndex, handlePlay]);

  const handleAutoAdvance = useCallback(() => {
    if (hasNext) handlePlay(episodes[currentIndex + 1]);
  }, [hasNext, episodes, currentIndex, handlePlay]);

  const handleClosePlayer = useCallback(() => {
    setCurrentEpisode(null);
  }, []);

  const handleExport = useCallback(async (epId) => {
    const result = await window.electron?.deskDownloads?.exportSingle(epId);
    if (result?.canceled) return;
    if (result?.success) toast.success('File exported successfully');
    else toast.error(result?.error || 'Export failed');
  }, []);

  const handleExportAll = useCallback(async () => {
    const ids = episodes.map((e) => e.id);
    const result = await window.electron?.deskDownloads?.exportBulk({ downloadIds: ids });
    if (result?.canceled) return;
    if (result?.success) toast.success(`${result.exported} file(s) exported successfully`);
    else toast.error(result?.error || 'Export failed');
  }, [episodes]);

  const isTv = type === 'tv' || episodes.some((d) => d.season != null);
  const singleFile = episodes.length === 1 && !isTv;

  return (
    <>
      <div className="h-full overflow-y-auto">
        <div className="relative w-full h-[400px] bg-gradient-to-b from-surface to-background">
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <button
            onClick={onBack}
            className="absolute top-lg left-lg z-10 flex items-center gap-sm text-text-primary hover:text-accent transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Back</span>
          </button>

          <div className="absolute bottom-0 left-0 right-0 px-xl pb-xl flex items-end gap-xl">
            <div className="w-[180px] shrink-0 rounded-card overflow-hidden shadow-lg -mb-16 relative z-10">
              {posterPath && !posterError ? (
                <img
                  src={`https://image.tmdb.org/t/p/w342${posterPath}`}
                  alt={title}
                  className="w-full aspect-[2/3] object-cover"
                  onError={() => setPosterError(true)}
                />
              ) : (
                <div className="w-full aspect-[2/3] bg-surface flex items-center justify-center">
                  {isTv ? <Tv className="w-10 h-10 text-text-muted" /> : <Film className="w-10 h-10 text-text-muted" />}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 pb-md relative z-10">
              <div className="flex items-center gap-sm mb-xs">
                <span className="text-xs font-medium uppercase tracking-wider text-accent">
                  {isTv ? 'TV Series' : 'Movie'}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-text-primary mb-xs">{title}</h1>
              <div className="flex items-center gap-md text-sm text-text-muted">
                <span>{episodes.length} file{episodes.length !== 1 ? 's' : ''} downloaded</span>
                {isTv && (
                  <span>
                    {[...new Set(episodes.map((d) => d.season).filter((s) => s != null))].length} season(s)
                  </span>
                )}
              </div>
              {isTv && episodes.length > 1 && (
                <div className="mt-md flex items-center gap-sm">
                  <button
                    onClick={() => onRequestDeleteAll?.(episodes.map((e) => e.id))}
                    className="flex items-center gap-sm px-lg py-sm bg-danger hover:bg-danger/80 text-background font-semibold rounded-button transition-colors text-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete All
                  </button>
                  <button
                    onClick={handleExportAll}
                    className="flex items-center gap-sm px-lg py-sm bg-accent hover:bg-accent-hover text-background font-semibold rounded-button transition-colors text-sm"
                  >
                    <Download className="w-4 h-4" />
                    Export All
                  </button>
                </div>
              )}
              {singleFile && (
                <div className="mt-md flex items-center gap-sm">
                  <button
                    onClick={() => handlePlay(episodes[0])}
                    className="flex items-center gap-sm px-lg py-sm bg-accent hover:bg-accent-hover text-background font-semibold rounded-button transition-colors text-sm"
                  >
                    <Play className="w-4 h-4" />
                    Play
                  </button>
                  <button
                    onClick={() => handleExport(episodes[0].id)}
                    className="flex items-center gap-sm px-lg py-sm bg-accent hover:bg-accent-hover text-background font-semibold rounded-button transition-colors text-sm"
                  >
                    <Download className="w-4 h-4" />
                    Export
                  </button>
                  <button
                    onClick={() => onRequestDelete?.(episodes[0].id)}
                    className="flex items-center gap-sm px-lg py-sm bg-danger hover:bg-danger/80 text-background font-semibold rounded-button transition-colors text-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-xl pt-20 pb-xl">
          {!singleFile && (
            <OfflineEpisodeGrid
              items={episodes}
              currentEpisodeId={currentEpisode?.id}
              onPlay={handlePlay}
              onExport={handleExport}
              onRequestDelete={onRequestDelete}
            />
          )}
        </div>
      </div>

      {currentEpisode && (
        <div className="fixed inset-0 z-50">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
            {hasPrev && (
              <button
                onClick={handlePrev}
                className="w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-6 h-6 text-white" />
              </button>
            )}
          </div>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10">
            {hasNext && (
              <button
                onClick={handleNext}
                className="w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center transition-colors"
              >
                <ChevronRight className="w-6 h-6 text-white" />
              </button>
            )}
          </div>
          <LocalPlayer
            filePath={currentEpisode.filePath}
            title={`${title}${currentEpisode.season != null ? ` - S${currentEpisode.season}E${currentEpisode.episode}` : ''}`}
            onClose={handleClosePlayer}
            onVideoEnded={handleAutoAdvance}
            subtitles={currentEpisode.subtitles}
          />
        </div>
      )}
    </>
  );
}
