import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { X } from 'lucide-react';
import { useDetailData } from '../hooks/useDetailData';
import { usePlayer } from '../hooks/usePlayer';
import MediaHero from '../components/MediaHero';
import PlayerSection from '../components/PlayerSection';
import EpisodeGrid from '../components/EpisodeGrid';
import MediaCard from '../components/MediaCard';
import MediaCarousel from '../components/MediaCarousel';
import TrailerList from '../components/TrailerList';
import SubtitleModal from '../components/SubtitleModal';
import DownloadModal from '../components/DownloadModal';
import LoadingScreen from '../components/LoadingScreen';

function DetailView({ media, activeProfile, onBack, onSelect, onProfileUpdated }) {
  const profileId = activeProfile?.id || 'master-id';
  const [retryCount, setRetryCount] = useState(0);
  const [showTrailerList, setShowTrailerList] = useState(false);
  const [trailerUrl, setTrailerUrl] = useState(null);
  const [trailerLoading, setTrailerLoading] = useState(true);
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [showDownload, setShowDownload] = useState(false);
  const [showEpisodeDropdown, setShowEpisodeDropdown] = useState(false);
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const [pipActive, setPipActive] = useState(false);
  const dropdownRef = useRef(null);
  const sourceDropdownRef = useRef(null);

  const {
    details,
    videos,
    seasons,
    selectedSeason,
    setSelectedSeason,
    episodes,
    relatedMovies,
    similarItems,
    loading,
    error,
    hasCached,
    isFavorite,
    isSaved,
    savedProgress,
    setSavedProgress,
    toggleFavorite,
    toggleSaved,
    updateSelectedSource,
  } = useDetailData(media, profileId, retryCount, activeProfile?.preferredSource, activeProfile?.isKids);

  const isUnreleased = useMemo(() => {
    if (!details) return false;
    const status = details.status;
    if (media.type === 'movie') {
      return status && status !== 'Released';
    }
    return status && !['Released', 'Returning Series', 'Ended'].includes(status);
  }, [details, media.type]);

  const [dubMode, setDubMode] = useState(() => {
    try {
      return localStorage.getItem('nexube_allmangaDubMode') || 'sub';
    } catch (_) { return 'sub'; }
  });

  useEffect(() => {
    try { localStorage.setItem('nexube_allmangaDubMode', dubMode); } catch (_) {}
  }, [dubMode]);

  const {
    playerUrl,
    playerLoading,
    currentEpisode,
    liveProgress,
    resolveError,
    clearResolveError,
    webviewRef,
    handlePlay,
    switchPlayerUrl,
    handleClosePlayer,
  } = usePlayer(details, profileId, `${media.type}-${media.tmdbId}`, details?.selectedSource, selectedSeason, activeProfile?.autoMarkThreshold, dubMode);

  useEffect(() => {
    if (liveProgress) setSavedProgress(liveProgress);
  }, [liveProgress]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowEpisodeDropdown(false);
      }
      if (sourceDropdownRef.current && !sourceDropdownRef.current.contains(e.target)) {
        setShowSourceDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handler = window.electron?.onPipStateChange?.((active) => {
      setPipActive(active);
    });
    return () => {
      if (handler) window.electron?.offPipStateChange?.(handler);
    };
  }, []);

  const handleTrailerSelect = useCallback((key) => {
    setShowTrailerList(false);
    setTrailerLoading(true);
    setTrailerUrl(`https://www.youtube.com/embed/${key}?autoplay=1&rel=0`);
  }, []);

  const handleCloseTrailer = useCallback(() => {
    setTrailerUrl(null);
    setTrailerLoading(true);
  }, []);

  const handlePopout = useCallback(() => {
    if (playerUrl) {
      window.electron?.player?.popout(playerUrl).catch(() => {});
    }
  }, [playerUrl]);

  const handleStopPip = useCallback(() => {
    window.electron?.player?.reattach?.();
  }, []);

  const handleEpisodeNavigation = useCallback(async (direction) => {
    if (media.type !== 'tv' || !currentEpisode) return;

    const targetEp = episodes.find((e) => e.episode_number === currentEpisode.episode_number + direction);
    if (targetEp) {
      switchPlayerUrl(targetEp);
      return;
    }

    const targetSeason = selectedSeason + direction;
    if (targetSeason < 1 || targetSeason > seasons.length) return;

    setSelectedSeason(targetSeason);
    try {
      const res = await window.electron?.tmdb?.fetch(`/tv/${media.tmdbId}/season/${targetSeason}`);
      if (res?.episodes?.length > 0) {
        const ep = direction > 0 ? res.episodes[0] : res.episodes[res.episodes.length - 1];
        switchPlayerUrl(ep);
      }
    } catch (err) {
      console.error('Failed to fetch season:', err);
    }
  }, [media.type, currentEpisode, episodes, selectedSeason, seasons.length, media.tmdbId, switchPlayerUrl, setSelectedSeason]);

  if (loading && !hasCached) {
    return <LoadingScreen message="Loading details..." />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-xl text-center">
        <span className="text-4xl mb-md"></span>
        <h2 className="text-lg font-bold text-text-primary mb-sm">Failed to load details</h2>
        <p className="text-sm text-text-muted mb-lg max-w-sm">{error}</p>
        <div className="flex gap-md">
          <button onClick={onBack} className="btn-secondary">Back</button>
          <button onClick={() => setRetryCount((c) => c + 1)} className="btn-primary">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <MediaHero
        details={details}
        videos={videos}
        isFavorite={isFavorite}
        isSaved={isSaved}
        savedProgress={savedProgress}
        onBack={onBack}
        onPlay={handlePlay}
        onToggleFavorite={toggleFavorite}
        onToggleSaved={toggleSaved}
        onShowTrailerList={() => setShowTrailerList(true)}
        onShowDownload={setShowDownload}
        isUnreleased={isUnreleased}
      />

      <div className="border-t border-border/50 mt-16 mb-xl" />

      <div className="py-xl">
        <div className="px-xl">
          <div className="max-w-3xl">
            <h2 className="text-lg font-bold text-text-primary mb-md">Overview</h2>
            <p className="text-text-muted leading-relaxed">{details?.overview || 'No overview available.'}</p>
          </div>
        </div>

        <div className="px-xl space-y-xl">
          {!isUnreleased && <PlayerSection
          details={details}
          mediaType={media.type}
          currentEpisode={currentEpisode}
          selectedSeason={selectedSeason}
          seasons={seasons}
          episodes={episodes}
          selectedSource={details?.selectedSource}
          playerUrl={playerUrl}
          playerLoading={playerLoading}
          liveProgress={liveProgress}
          savedProgress={savedProgress}
          resolveError={resolveError}
          dubMode={dubMode}
          webviewRef={webviewRef}
          dropdownRef={dropdownRef}
          sourceDropdownRef={sourceDropdownRef}
          showEpisodeDropdown={showEpisodeDropdown}
          showSourceDropdown={showSourceDropdown}
          onToggleEpisodeDropdown={() => setShowEpisodeDropdown(!showEpisodeDropdown)}
          onToggleSourceDropdown={() => setShowSourceDropdown(!showSourceDropdown)}
          onSeasonChange={setSelectedSeason}
          onEpisodeSelect={(ep) => {
            switchPlayerUrl(ep);
            setShowEpisodeDropdown(false);
          }}
          onSourceSelect={async (source) => {
            updateSelectedSource(source);
            setShowSourceDropdown(false);
            switchPlayerUrl(currentEpisode, source);
          }}
          onDubModeToggle={() => {
            const next = dubMode === 'sub' ? 'dub' : 'sub';
            setDubMode(next);
            clearResolveError();
            switchPlayerUrl(currentEpisode);
          }}
          pipActive={pipActive}
          onStopPip={handleStopPip}
          onPopout={handlePopout}
          onPrevEpisode={() => handleEpisodeNavigation(-1)}
          onNextEpisode={() => handleEpisodeNavigation(1)}
          onClose={handleClosePlayer}
          onDownload={() => setShowDownload(true)}
        />}

        {trailerUrl && (
          <div>
            <div className="relative aspect-video rounded-card overflow-hidden bg-black">
              {trailerLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
                  <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              <iframe
                src={trailerUrl}
                className="w-full h-full"
                allow="autoplay; encrypted-media"
                allowFullScreen
                onLoad={() => setTrailerLoading(false)}
              />
              <button
                onClick={handleCloseTrailer}
                className="absolute top-sm right-sm p-sm bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors z-20"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {media.type === 'tv' && seasons.length > 0 && (isUnreleased ? (
          <div className="mt-2xl pt-xl border-t border-border/50">
            <h2 className="text-lg font-bold text-text-primary mb-md">Seasons</h2>
            {seasons.length > 1 ? (
              <select
                value={selectedSeason}
                onChange={(e) => setSelectedSeason(Number(e.target.value))}
                className="bg-surface text-text-primary border border-border rounded-button px-md py-sm text-sm focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
              >
                {seasons.map((s) => (
                  <option key={s.season_number} value={s.season_number}>
                    Season {s.season_number}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-text-muted text-sm">Season 1</p>
            )}
          </div>
        ) : (
          <EpisodeGrid
            seasons={seasons}
            selectedSeason={selectedSeason}
            episodes={episodes}
            onSeasonChange={setSelectedSeason}
            onPlayEpisode={handlePlay}
          />
        ))}
        </div>

        {relatedMovies.length > 0 && (
          <div className="mt-2xl pt-xl border-t border-border/50">
            <div className="px-xl">
              <h2 className="text-lg font-bold text-text-primary mb-md">More in this Collection</h2>
            </div>
            <div className="flex gap-md overflow-x-auto px-xl py-md">
              {relatedMovies.map((movie) => (
                <MediaCard
                  key={movie.id}
                  media={movie}
                  onClick={onSelect}
                />
              ))}
            </div>
          </div>
        )}

        {similarItems.length > 0 && (
          <div className="mt-2xl pt-xl border-t border-border/50">
            <MediaCarousel
              title={`Similar ${media.type === 'movie' ? 'Movies' : 'Shows'}`}
              items={similarItems}
              onSelect={onSelect}
            />
          </div>
        )}
      </div>

      {showTrailerList && (
        <TrailerList
          videos={videos}
          onSelect={handleTrailerSelect}
          onClose={() => setShowTrailerList(false)}
        />
      )}
      {showSubtitles && <SubtitleModal tmdbId={media.tmdbId} type={media.type} onClose={() => setShowSubtitles(false)} />}
      {showDownload && <DownloadModal media={media} activeProfile={activeProfile} sourceId={details?.selectedSource?.id} isAnime={details?.isAnime} onClose={() => setShowDownload(false)} onProfileUpdated={onProfileUpdated} relatedMovies={relatedMovies} />}
    </div>
  );
}

export default DetailView;
