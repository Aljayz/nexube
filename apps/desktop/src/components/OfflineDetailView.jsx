import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Play, Download, Film, Tv, Trash2, Subtitles, Loader2, CheckCircle, X, Globe, ChevronDown } from 'lucide-react';
import LocalPlayer from './LocalPlayer';
import OfflineEpisodeGrid from './OfflineEpisodeGrid';
import { useSettings } from '../hooks/useSettings';

const LANG_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ru', label: 'Russian' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ar', label: 'Arabic' },
  { code: 'nl', label: 'Dutch' },
  { code: 'pl', label: 'Polish' },
  { code: 'sv', label: 'Swedish' },
  { code: 'tr', label: 'Turkish' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'th', label: 'Thai' },
  { code: 'id', label: 'Indonesian' },
];

export default function OfflineDetailView({ title, type, posterPath, tmdbId, items, onBack, onRequestDelete, onRequestDeleteAll, onDelete, onDeleteAll }) {
  const { subtitleLanguages, subtitleSources } = useSettings();
  const [currentEpisode, setCurrentEpisode] = useState(null);
  const [posterError, setPosterError] = useState(false);
  const [subtitleModal, setSubtitleModal] = useState(null);
  const [subChecking, setSubChecking] = useState(false);
  const [selectedLangs, setSelectedLangs] = useState(null);
  const [selectedSources, setSelectedSources] = useState(null);
  const [availableSources, setAvailableSources] = useState([]);
  const [langOpen, setLangOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [subFetching, setSubFetching] = useState(null);
  const [episodeSubs, setEpisodeSubs] = useState(null);
  const [episodeProgress, setEpisodeProgress] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const langRef = useRef(null);
  const srcRef = useRef(null);

  useEffect(() => {
    if (items.length === 0) return;
    (async () => {
      try {
        const ids = items.map((d) => d.id);
        const result = await window.electron?.deskDownloads?.getBulkProgress(ids);
        if (result?.success) {
          setEpisodeProgress(result.results);
        }
      } catch {}
    })();
  }, [items]);

  useEffect(() => {
    if (!subtitleModal) return;
    (async () => {
      setSourcesLoading(true);
      try {
        const result = await window.electron?.deskDownloads?.getSources();
        if (result?.success) {
          const freeKeys = Array.isArray(result.free) ? result.free : [];
          const tiered = Array.isArray(result.tiered) ? result.tiered : [];
          const tieredMap = {};
          tiered.forEach((s) => { tieredMap[s.key] = s; });
          const freeSources = freeKeys.map((key) =>
            tieredMap[key] || { key, name: key, tier: 'free', available: true }
          );
          setAvailableSources(freeSources);
        } else {
          setAvailableSources([]);
        }
      } catch {
        setAvailableSources([]);
      } finally {
        setSourcesLoading(false);
      }
    })();
  }, [subtitleModal]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (langRef.current && !langRef.current.contains(e.target)) {
        setLangOpen(false);
      }
      if (srcRef.current && !srcRef.current.contains(e.target)) {
        setSourcesOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const handleCheckSubtitles = useCallback(async () => {
    setSelectedLangs(subtitleLanguages.length > 0 ? [...subtitleLanguages] : ['en']);
    setSelectedSources(subtitleSources || 'all');
    setSubChecking(true);
    setSubtitleModal({ type: 'checking' });
    try {
      const ids = episodes.map((e) => e.id);
      const result = await window.electron?.deskDownloads?.checkMissingSubtitles(ids);
      if (result?.success) {
        const missing = result.results.filter((r) => !r.hasSubtitles);
        setSubtitleModal({ type: 'results', missing, all: result.results });
      } else {
        setSubtitleModal({ type: 'error', message: result?.error || 'Failed to check subtitles' });
      }
    } catch (err) {
      setSubtitleModal({ type: 'error', message: err.message });
    } finally {
      setSubChecking(false);
    }
  }, [episodes, subtitleLanguages, subtitleSources]);

  const handleFetchSubtitles = useCallback(async (epId) => {
    setSubFetching(epId);
    try {
      const langs = selectedLangs || subtitleLanguages || ['en'];
      const sources = selectedSources || subtitleSources || 'all';
      const result = await window.electron?.deskDownloads?.fetchSubtitles({ downloadId: epId, languages: langs, sources });
      if (result?.success) {
        toast.success(`Downloaded ${result.count} subtitle file(s)`);
      } else {
        toast.error(result?.error || 'Failed to fetch subtitles');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubFetching(null);
    }
  }, [selectedLangs, selectedSources, subtitleLanguages, subtitleSources]);

  const handleFetchAllSubtitles = useCallback(async () => {
    const missing = subtitleModal?.missing || [];
    if (missing.length === 0) return;
    setSubFetching('all');
    let success = 0;
    let fail = 0;
    const langs = selectedLangs || subtitleLanguages || ['en'];
    const sources = selectedSources || subtitleSources || 'all';
    for (const ep of missing) {
      try {
        const result = await window.electron?.deskDownloads?.fetchSubtitles({ downloadId: ep.id, languages: langs, sources });
        if (result?.success) success++;
        else fail++;
      } catch {
        fail++;
      }
    }
    setSubFetching(null);
    setSubtitleModal(null);
    toast.success(`${success} subtitle(s) fetched${fail > 0 ? `, ${fail} failed` : ''}`);
  }, [subtitleModal, selectedLangs, selectedSources, subtitleLanguages, subtitleSources]);

  const handleToggleLang = useCallback((code) => {
    setSelectedLangs((prev) => {
      const langs = prev || subtitleLanguages || ['en'];
      return langs.includes(code) ? langs.filter((l) => l !== code) : [...langs, code];
    });
  }, [subtitleLanguages]);

  const handleToggleSource = useCallback((sourceKey) => {
    setSelectedSources((prev) => {
      const allKeys = availableSources.map((s) => s.key);
      const cur = prev === 'all' ? allKeys : (prev || '').split(',').filter(Boolean);
      const next = cur.includes(sourceKey) ? cur.filter((s) => s !== sourceKey) : [...cur, sourceKey];
      if (next.length === allKeys.length || next.length === 0) return 'all';
      return next.join(',');
    });
  }, [availableSources]);

  const handleCloseSubtitleModal = useCallback(() => {
    setSubtitleModal(null);
    setLangOpen(false);
    setSourcesOpen(false);
  }, []);

  const handleDeleteClick = useCallback((id) => {
    setConfirmDelete({ id });
  }, []);

  const handleDeleteAllClick = useCallback((ids) => {
    setConfirmDelete({ ids });
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!confirmDelete) return;
    if (confirmDelete.ids) {
      for (const id of confirmDelete.ids) {
        await window.electron?.deskDownloads?.['delete'](id);

      }
      onDeleteAll?.(confirmDelete.ids);
    } else {
      await window.electron?.deskDownloads?.['delete'](confirmDelete.id);
      onDelete?.(confirmDelete.id);
    }
    setConfirmDelete(null);
  }, [confirmDelete, onDelete, onDeleteAll]);

  const handleCancelDelete = useCallback(() => {
    setConfirmDelete(null);
  }, []);

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
                    onClick={handleCheckSubtitles}
                    className="flex items-center gap-sm px-lg py-sm bg-surface hover:bg-surface-hover text-text-primary font-semibold rounded-button transition-colors text-sm border border-border"
                  >
                    <Subtitles className="w-4 h-4" />
                    Subtitles
                  </button>
                  <button
                    onClick={() => handleDeleteAllClick(episodes.map((e) => e.id))}
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
                <div className="mt-md flex items-center gap-sm flex-wrap">
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
                    onClick={handleCheckSubtitles}
                    className="flex items-center gap-sm px-lg py-sm bg-surface hover:bg-surface-hover text-text-primary font-semibold rounded-button transition-colors text-sm border border-border"
                  >
                    <Subtitles className="w-4 h-4" />
                    Subtitles
                  </button>
                  <button
                    onClick={() => handleDeleteClick(episodes[0].id)}
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
              onRequestDelete={handleDeleteClick}
              episodeProgress={episodeProgress}
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
            downloadId={currentEpisode.id}
          />
        </div>
      )}

      {subtitleModal && (
        <div className="fixed inset-0 bg-overlay backdrop-blur-overlay z-50 flex items-center justify-center p-xl" onClick={handleCloseSubtitleModal}>
          <div className="relative w-full max-w-lg bg-surface rounded-xl overflow-hidden shadow-xl border border-border max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-lg py-md border-b border-border shrink-0">
              <div className="flex items-center gap-sm">
                <Subtitles className="w-5 h-5 text-accent" />
                <h3 className="text-lg font-bold text-text-primary">Subtitles</h3>
              </div>
              <button onClick={handleCloseSubtitleModal} className="text-text-muted hover:text-text-primary transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-lg overflow-y-auto flex-1">
              {selectedLangs && (
                <div className="mb-md">
                  <p className="text-xs text-text-muted mb-sm">Languages:</p>
                  <div className="relative" ref={langRef}>
                    <button
                      onClick={() => setLangOpen((v) => !v)}
                      className="w-full flex items-center gap-sm px-sm py-sm rounded border border-border bg-surface text-text-primary text-sm hover:border-accent transition-colors text-left"
                    >
                      <Globe className="w-4 h-4 shrink-0 text-text-muted" />
                      <span className="flex-1 truncate">
                        {selectedLangs.length === 0
                          ? 'Select languages'
                          : selectedLangs.length === 1
                            ? LANG_OPTIONS.find((l) => l.code === selectedLangs[0])?.label || selectedLangs[0]
                            : `${selectedLangs.length} languages selected`}
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 text-text-muted transition-transform ${langOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {langOpen && (
                      <div className="absolute top-full left-0 right-0 mt-xs z-10 bg-surface border border-border rounded-xl shadow-lg max-h-60 overflow-y-auto">
                        {LANG_OPTIONS.map((lang) => (
                          <label
                            key={lang.code}
                            className="flex items-center gap-sm px-sm py-2xs hover:bg-surface-hover cursor-pointer text-sm text-text-primary transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={selectedLangs.includes(lang.code)}
                              onChange={() => handleToggleLang(lang.code)}
                              className="w-3.5 h-3.5 accent-accent"
                            />
                            {lang.label}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedSources && (
                <div className="mb-md">
                  <p className="text-xs text-text-muted mb-sm">Sources:</p>
                  {sourcesLoading ? (
                    <div className="flex items-center gap-sm text-text-muted text-sm">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Loading sources...</span>
                    </div>
                  ) : availableSources.length > 0 ? (
                    <div className="relative" ref={srcRef}>
                      <button
                        onClick={() => setSourcesOpen((v) => !v)}
                        className="w-full flex items-center gap-sm px-sm py-sm rounded border border-border bg-surface text-text-primary text-sm hover:border-accent transition-colors text-left"
                      >
                        <Globe className="w-4 h-4 shrink-0 text-text-muted" />
                        <span className="flex-1 truncate">
                          {selectedSources === 'all' || !selectedSources
                            ? 'All Sources'
                            : `${selectedSources.split(',').length} source(s) selected`}
                        </span>
                        <ChevronDown className={`w-3.5 h-3.5 text-text-muted transition-transform ${sourcesOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {sourcesOpen && (
                        <div className="absolute top-full left-0 right-0 mt-xs z-10 bg-surface border border-border rounded-xl shadow-lg max-h-60 overflow-y-auto">
                          <label key="all-sources" className="flex items-center gap-sm px-sm py-2xs hover:bg-surface-hover cursor-pointer text-sm text-text-primary transition-colors">
                            <input
                              type="checkbox"
                              checked={selectedSources === 'all' || !selectedSources}
                              onChange={() => setSelectedSources((prev) => (prev === 'all' || !prev) ? '' : 'all')}
                              className="w-3.5 h-3.5 accent-accent"
                            />
                            All Sources
                          </label>
                          {availableSources.map((src) => {
                            const active = selectedSources === 'all' || (selectedSources || '').split(',').includes(src.key);
                            return (
                              <label
                                key={src.key}
                                className="flex items-center gap-sm px-sm py-2xs hover:bg-surface-hover cursor-pointer text-sm text-text-primary transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={active}
                                  onChange={() => handleToggleSource(src.key)}
                                  className="w-3.5 h-3.5 accent-accent"
                                />
                                {src.name || src.key}
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-text-muted">No sources available. Add a Wyzie API key in Settings.</p>
                  )}
                </div>
              )}

              {subChecking && (
                <div className="flex items-center gap-sm text-text-muted">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Checking subtitles...</span>
                </div>
              )}

              {subtitleModal.type === 'error' && (
                <div className="text-sm text-danger">{subtitleModal.message}</div>
              )}

              {subtitleModal.type === 'results' && (
                <>
                  <p className="text-sm text-text-muted mb-md">
                    {subtitleModal.missing.length === 0
                      ? 'All episodes have subtitles.'
                      : `${subtitleModal.missing.length} episode(s) missing subtitles.`}
                  </p>

                  {subtitleModal.missing.length > 0 && (
                    <div className="space-y-1 max-h-60 overflow-y-auto mb-md">
                      {subtitleModal.missing.map((ep) => (
                        <div key={ep.id} className="flex items-center justify-between px-sm py-2xs hover:bg-surface-hover rounded">
                          <span className="text-sm text-text-primary truncate">
                            {ep.title}
                            {ep.season != null && ` S${ep.season}E${ep.episode}`}
                          </span>
                          <button
                            onClick={() => handleFetchSubtitles(ep.id)}
                            disabled={subFetching === ep.id}
                            className="text-xs text-accent hover:underline disabled:opacity-50 shrink-0 ml-sm"
                          >
                            {subFetching === ep.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Download className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {subtitleModal.type === 'results' && subtitleModal.missing.length > 0 && (
              <div className="px-lg py-md border-t border-border shrink-0">
                <button
                  onClick={handleFetchAllSubtitles}
                  disabled={subFetching === 'all'}
                  className="btn-primary w-full flex items-center justify-center gap-sm"
                >
                  {subFetching === 'all' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Download All Missing
                </button>
              </div>
            )}

            {subtitleModal.type === 'results' && subtitleModal.missing.length === 0 && (
              <div className="px-lg py-md border-t border-border shrink-0">
                <div className="flex items-center justify-center gap-sm text-sm text-success">
                  <CheckCircle className="w-4 h-4" />
                  <span>All subtitles available</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {confirmDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60" onClick={handleCancelDelete}>
          <div
            className="bg-surface rounded-xl p-xl max-w-md w-full mx-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-text-primary mb-sm">Confirm Delete</h3>
            <p className="text-sm text-text-muted mb-lg">
              {confirmDelete.ids
                ? `This will permanently delete all ${confirmDelete.ids.length} files under this series. Continue?`
                : 'Are you sure you want to delete this download?'}
            </p>
            <div className="flex items-center justify-end gap-sm">
              <button
                onClick={handleCancelDelete}
                className="px-lg py-sm rounded-button border border-border text-text-primary hover:bg-surface/80 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-lg py-sm rounded-button bg-danger hover:bg-danger/80 text-background font-semibold transition-colors text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
