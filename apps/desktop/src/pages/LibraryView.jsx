import { useState, useEffect, useMemo } from 'react';
import MediaCard from '../components/MediaCard';
import WatchlistReorder from '../components/WatchlistReorder';
import LoadingScreen from '../components/LoadingScreen';
import { Library, Film, Tv } from 'lucide-react';

const TABS = [
  { id: 'continue', label: 'Continue Watching' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'watchlist', label: 'Watchlist' },
  { id: 'history', label: 'History' },
];

function mapLibraryItem(item) {
  return {
    id: `${item.type}-${item.tmdb_id}`,
    tmdbId: item.tmdb_id,
    title: item.title,
    type: item.type,
    posterPath: item.poster_path,
    backdropPath: item.backdrop_path,
    overview: item.overview,
    releaseDate: item.release_date,
    voteAverage: item.vote_average,
    voteCount: item.vote_count,
    popularity: item.popularity,
    originalLanguage: item.original_language,
    genreIds: item.genres ? JSON.parse(item.genres).map((g) => g.id) : [],
    isAnime: item.original_language === 'ja',
    progress: item.progress_percent || 0,
    progressSeconds: item.progress_seconds || 0,
    duration: item.duration || 0,
    lastWatched: item.last_watched || item.added_at || item.completed_at,
    season: item.season,
    episode: item.episode,
    mediaId: `${item.type}-${item.tmdb_id}`,
  };
}

function LibraryView({ activeProfile, onSelect }) {
  const profileId = activeProfile?.id || 'master-id';
  const [activeTab, setActiveTab] = useState('continue');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [hasCached, setHasCached] = useState(false);

  const [allFavorites, setAllFavorites] = useState([]);
  const [allSaved, setAllSaved] = useState([]);
  const [allHistory, setAllHistory] = useState([]);
  const [allContinue, setAllContinue] = useState([]);

  async function fetchLibrary(isRetry = false) {
    if (!isRetry) setError(null);

    try {
      const [favorites, saved, history, continueWatching] = await Promise.all([
        window.electron?.library?.favorites?.list(profileId),
        window.electron?.library?.saved?.list(profileId),
        window.electron?.library?.history?.list(profileId),
        window.electron?.library?.progress?.continueWatching(profileId),
      ]);

      setAllFavorites((favorites || []).map(mapLibraryItem));
      setAllSaved((saved || []).map(mapLibraryItem));
      setAllHistory((history || []).map(mapLibraryItem));
      setAllContinue((continueWatching || []).map(mapLibraryItem));
      setHasCached(true);
    } catch (err) {
      setError(err.message || 'Failed to load library');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLibrary(retryCount > 0);
  }, [retryCount, profileId]);

  const getTabItems = useMemo(() => {
    let raw;
    switch (activeTab) {
      case 'continue':
        raw = allContinue;
        break;
      case 'favorites':
        raw = allFavorites;
        break;
      case 'watchlist':
        raw = allSaved;
        break;
      case 'history':
        raw = allHistory;
        break;
      default:
        raw = [];
    }
    const movies = raw.filter((i) => i.type === 'movie').sort((a, b) => new Date(b.lastWatched || 0) - new Date(a.lastWatched || 0));
    const tv = raw.filter((i) => i.type === 'tv').sort((a, b) => new Date(b.lastWatched || 0) - new Date(a.lastWatched || 0));
    return { movies, tv };
  }, [activeTab, allFavorites, allSaved, allHistory, allContinue]);

  const hasAnyContent = getTabItems.movies.length > 0 || getTabItems.tv.length > 0;

  if (loading && !hasCached) {
    return <LoadingScreen message="Loading library..." />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-xl text-center">
        <span className="text-4xl mb-md"></span>
        <h2 className="text-lg font-bold text-text-primary mb-sm">Failed to load library</h2>
        <p className="text-sm text-text-muted mb-lg max-w-sm">{error}</p>
        <button onClick={() => setRetryCount((c) => c + 1)} className="btn-primary">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="px-lg py-lg">
      <h1 className="text-2xl font-bold text-text-primary mb-lg">My Library</h1>

      <div className="flex gap-xs mb-lg border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-md py-sm text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {!hasAnyContent ? (
        <div className="flex flex-col items-center justify-center h-64 text-text-muted">
          <Library className="w-12 h-12 mb-md" />
          <span className="text-4xl mb-md"></span>
          <p className="text-lg">Your {TABS.find((t) => t.id === activeTab)?.label} is empty</p>
          <p className="text-sm mt-sm">Start watching, favoriting, or saving movies and shows</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2xl">
          {getTabItems.movies.length > 0 && (
            <div className="library-section">
              <h2 className="text-lg font-bold text-text-primary mb-md flex items-center gap-sm">
                <Film className="w-4 h-4" /> Movies
              </h2>
              {activeTab === 'watchlist' ? (
                <WatchlistReorder
                  items={getTabItems.movies}
                  onSelect={onSelect}
                  onReorder={(newItems) => {
                    console.log('Reordered:', newItems);
                  }}
                />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-md">
                  {getTabItems.movies.map((item) => (
                    <MediaCard
                      key={item.id}
                      media={item}
                      onClick={onSelect}
                      showProgress={activeTab === 'continue'}
                      progress={item.progress}
                      showWatched={activeTab === 'history'}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {getTabItems.tv.length > 0 && (
            <div className="library-section">
              <h2 className="text-lg font-bold text-text-primary mb-md flex items-center gap-sm">
                <Tv className="w-4 h-4" /> TV Series
              </h2>
              {activeTab === 'watchlist' ? (
                <WatchlistReorder
                  items={getTabItems.tv}
                  onSelect={onSelect}
                  onReorder={(newItems) => {
                    console.log('Reordered:', newItems);
                  }}
                />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-md">
                  {getTabItems.tv.map((item) => (
                    <MediaCard
                      key={item.id}
                      media={item}
                      onClick={onSelect}
                      showProgress={activeTab === 'continue'}
                      progress={item.progress}
                      showWatched={activeTab === 'history'}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default LibraryView;
