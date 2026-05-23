import { useState, useEffect } from 'react';
import Billboard from '../components/Billboard';
import MediaCarousel from '../components/MediaCarousel';
import LoadingScreen from '../components/LoadingScreen';

function HomeView({ activeProfile, onSelect }) {
  const profileId = activeProfile?.id || 'master-id';
  const [trending, setTrending] = useState([]);
  const [popular, setPopular] = useState([]);
  const [topRated, setTopRated] = useState([]);
  const [nowPlaying, setNowPlaying] = useState([]);
  const [trendingTV, setTrendingTV] = useState([]);
  const [popularTV, setPopularTV] = useState([]);
  const [topRatedTV, setTopRatedTV] = useState([]);
  const [billboard, setBillboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [hasCached, setHasCached] = useState(false);
  const [progressMap, setProgressMap] = useState({});
  const [similarItems, setSimilarItems] = useState([]);
  const [similarLabel, setSimilarLabel] = useState('');
  const [continueWatching, setContinueWatching] = useState([]);

  const mapItem = (item, type) => ({
    id: `${type}-${item.id}`,
    tmdbId: item.id,
    title: item.title || item.name,
    type,
    mediaType: type === 'movie' ? 'Movie' : 'TV',
    posterPath: item.poster_path,
    backdropPath: item.backdrop_path,
    overview: item.overview,
    releaseDate: item.release_date || item.first_air_date,
    voteAverage: item.vote_average,
    voteCount: item.vote_count,
    popularity: item.popularity,
    originalLanguage: item.original_language,
    genreIds: item.genre_ids || [],
    isAnime: item.original_language === 'ja' && item.genre_ids?.includes(16),
  });

  async function fetchData(isRetry = false) {
    if (!isRetry) setError(null);

    try {
      const [trendingRes, popularRes, topRatedRes, nowPlayingRes, trendingTVRes, popularTVRes, topRatedTVRes] = await Promise.allSettled([
        window.electron?.tmdb?.fetch('/trending/movie/week'),
        window.electron?.tmdb?.fetch('/movie/popular'),
        window.electron?.tmdb?.fetch('/movie/top_rated'),
        window.electron?.tmdb?.fetch('/movie/now_playing'),
        window.electron?.tmdb?.fetch('/trending/tv/week'),
        window.electron?.tmdb?.fetch('/tv/popular'),
        window.electron?.tmdb?.fetch('/tv/top_rated'),
      ]);

      const trendingItems = trendingRes.status === 'fulfilled' && trendingRes.value?.results
        ? trendingRes.value.results.map((i) => mapItem(i, 'movie'))
        : [];
      const popularItems = popularRes.status === 'fulfilled' && popularRes.value?.results
        ? popularRes.value.results.map((i) => mapItem(i, 'movie'))
        : [];
      const topRatedItems = topRatedRes.status === 'fulfilled' && topRatedRes.value?.results
        ? topRatedRes.value.results.map((i) => mapItem(i, 'movie'))
        : [];
      const nowPlayingItems = nowPlayingRes.status === 'fulfilled' && nowPlayingRes.value?.results
        ? nowPlayingRes.value.results.map((i) => mapItem(i, 'movie'))
        : [];

      const trendingTVItems = trendingTVRes.status === 'fulfilled' && trendingTVRes.value?.results
        ? trendingTVRes.value.results.map((i) => mapItem(i, 'tv'))
        : [];
      const popularTVItems = popularTVRes.status === 'fulfilled' && popularTVRes.value?.results
        ? popularTVRes.value.results.map((i) => mapItem(i, 'tv'))
        : [];
      const topRatedTVItems = topRatedTVRes.status === 'fulfilled' && topRatedTVRes.value?.results
        ? topRatedTVRes.value.results.map((i) => mapItem(i, 'tv'))
        : [];

      const hasAnyData = trendingItems.length > 0 || popularItems.length > 0 || topRatedItems.length > 0 || nowPlayingItems.length > 0 || trendingTVItems.length > 0 || popularTVItems.length > 0 || topRatedTVItems.length > 0;

      if (!hasAnyData) {
        throw new Error('Failed to load content. Please check your connection.');
      }

      setTrending(trendingItems);
      setPopular(popularItems);
      setTopRated(topRatedItems);
      setNowPlaying(nowPlayingItems);
      setTrendingTV(trendingTVItems);
      setPopularTV(popularTVItems);
      setTopRatedTV(topRatedTVItems);
      setHasCached(true);

      if (trendingItems.length > 0) {
        const featured = trendingItems[Math.floor(Math.random() * Math.min(5, trendingItems.length))];
        if (featured.backdropPath) {
          setBillboard(featured);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load content');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData(retryCount > 0);
  }, [retryCount]);

  useEffect(() => {
    if (!hasCached) return;
    async function loadProgress() {
      try {
        const cwData = await window.electron?.library?.progress?.continueWatching(profileId);
        if (cwData && Array.isArray(cwData)) {
          const map = {};
          const items = [];
          for (const item of cwData) {
            const key = `${item.type}-${item.tmdb_id}`;
            map[key] = item.progress_percent || 0;
            items.push({
              id: key,
              tmdbId: item.tmdb_id,
              title: item.title,
              type: item.type,
              mediaType: item.type === 'movie' ? 'Movie' : 'TV',
              posterPath: item.poster_path,
              backdropPath: item.backdrop_path,
              overview: item.overview,
              releaseDate: item.release_date,
              voteAverage: item.vote_average,
              voteCount: item.vote_count,
              popularity: item.popularity,
              originalLanguage: item.original_language,
              genreIds: [],
              isAnime: !!item.is_anime,
              progress_percent: item.progress_percent,
            });
          }
          setProgressMap(map);
          setContinueWatching(items);
        }
      } catch (err) {
        console.error('Failed to load progress:', err);
      }
    }
    loadProgress();
  }, [hasCached, profileId]);

  useEffect(() => {
    if (!hasCached) return;
    let mounted = true;
    async function loadSimilar() {
      try {
        const favorites = await window.electron?.library?.favorites?.list(profileId);
        if (!mounted || !favorites || favorites.length === 0) return;
        const latest = favorites[0];
        const endpoint = latest.type === 'tv' ? `/tv/${latest.tmdb_id}/similar` : `/movie/${latest.tmdb_id}/similar`;
        const res = await window.electron?.tmdb?.fetch(endpoint);
        if (!mounted || !res?.results || res.results.length === 0) return;
        setSimilarItems(res.results.map((i) => mapItem(i, latest.type)));
        setSimilarLabel(`Similar to ${latest.title}`);
      } catch {}
    }
    loadSimilar();
    return () => { mounted = false; };
  }, [hasCached, profileId]);

  if (loading && !hasCached) {
    return <LoadingScreen message="Loading content..." />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-xl text-center">
        <span className="text-4xl mb-md"></span>
        <h2 className="text-lg font-bold text-text-primary mb-sm">Failed to load content</h2>
        <p className="text-sm text-text-muted mb-lg max-w-sm">{error}</p>
        <button onClick={() => setRetryCount((c) => c + 1)} className="btn-primary">
          Retry
        </button>
      </div>
    );
  }

  const hasContent = trending.length > 0 || popular.length > 0 || topRated.length > 0 || nowPlaying.length > 0;

  if (!hasContent) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-xl text-center">
        <span className="text-4xl mb-md"></span>
        <h2 className="text-lg font-bold text-text-primary mb-sm">No content available</h2>
        <p className="text-sm text-text-muted">Try again later or check your API key in Settings</p>
      </div>
    );
  }

  return (
    <div>
      {billboard && (
        <Billboard
          media={billboard}
          onPlay={onSelect}
          onInfo={onSelect}
        />
      )}

      <div className="flex flex-col gap-xl px-lg py-lg">
        {continueWatching.length > 0 && (
          <MediaCarousel
            title="Continue Watching"
            items={continueWatching}
            onSelect={onSelect}
            showProgress
            getProgress={(id) => {
              const item = continueWatching.find((i) => i.id === id);
              return item?.progress_percent || 0;
            }}
          />
        )}
        {similarItems.length > 0 && (
          <MediaCarousel
            title={similarLabel}
            items={similarItems}
            onSelect={onSelect}
            showProgress
            getProgress={(id) => progressMap[id] || 0}
          />
        )}
        {trending.length > 0 && (
          <MediaCarousel
            title="Trending This Week"
            items={trending}
            onSelect={onSelect}
            showProgress
            getProgress={(id) => progressMap[id] || 0}
          />
        )}
        {popular.length > 0 && (
          <MediaCarousel
            title="Popular Movies"
            items={popular}
            onSelect={onSelect}
            showProgress
            getProgress={(id) => progressMap[id] || 0}
          />
        )}
        {topRated.length > 0 && (
          <MediaCarousel
            title="Top Rated"
            items={topRated}
            onSelect={onSelect}
            showProgress
            getProgress={(id) => progressMap[id] || 0}
          />
        )}
        {nowPlaying.length > 0 && (
          <MediaCarousel
            title="Now Playing in Theaters"
            items={nowPlaying}
            onSelect={onSelect}
            showProgress
            getProgress={(id) => progressMap[id] || 0}
          />
        )}
        {trendingTV.length > 0 && (
          <MediaCarousel
            title="Trending TV Shows"
            items={trendingTV}
            onSelect={onSelect}
            showProgress
            getProgress={(id) => progressMap[id] || 0}
          />
        )}
        {popularTV.length > 0 && (
          <MediaCarousel
            title="Popular TV Series"
            items={popularTV}
            onSelect={onSelect}
            showProgress
            getProgress={(id) => progressMap[id] || 0}
          />
        )}
        {topRatedTV.length > 0 && (
          <MediaCarousel
            title="Top Rated TV Shows"
            items={topRatedTV}
            onSelect={onSelect}
            showProgress
            getProgress={(id) => progressMap[id] || 0}
          />
        )}
      </div>
    </div>
  );
}

export default HomeView;
