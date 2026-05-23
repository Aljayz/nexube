import { useState, useEffect, useMemo } from 'react';
import { Bell, Film, Tv, Sparkles, Calendar } from 'lucide-react';
import LoadingScreen from '../components/LoadingScreen';

const TABS = [
  { id: 'updates', label: 'Updates' },
  { id: 'movies', label: 'Movie Updates' },
  { id: 'tv', label: 'TV Series Updates' },
];

function NotificationView({ activeProfile, onSelect }) {
  const profileId = activeProfile?.id || 'master-id';
  const [activeTab, setActiveTab] = useState('updates');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [hasCached, setHasCached] = useState(false);

  const [movieUpdates, setMovieUpdates] = useState([]);
  const [tvUpdates, setTvUpdates] = useState([]);

  async function fetchUpdates(isRetry = false) {
    if (!isRetry) setError(null);

    try {
      const favorites = await window.electron?.library?.favorites?.list(profileId);
      if (!favorites || favorites.length === 0) {
        setHasCached(true);
        setLoading(false);
        return;
      }

      const movies = favorites.filter((f) => f.type === 'movie');
      const tvShows = favorites.filter((f) => f.type === 'tv');

      const moviePromises = movies.map(async (movie) => {
        try {
          const details = await window.electron?.tmdb?.fetch(`/movie/${movie.tmdb_id}`);
          if (!details) return null;

          const now = new Date();
          const releaseDate = new Date(details.release_date);
          const daysUntilRelease = Math.ceil((releaseDate - now) / (1000 * 60 * 60 * 24));

          if (daysUntilRelease > 0 && daysUntilRelease <= 30) {
            return {
              id: `movie-update-${movie.tmdb_id}`,
              mediaId: `${movie.type}-${movie.tmdb_id}`,
              title: movie.title,
              posterPath: movie.poster_path,
              type: 'upcoming',
              message: `Releasing in ${daysUntilRelease} days (${details.release_date})`,
              date: details.release_date,
              mediaType: 'movie',
            };
          }

          if (details.status === 'Released' && releaseDate > new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)) {
            return {
              id: `movie-released-${movie.tmdb_id}`,
              mediaId: `${movie.type}-${movie.tmdb_id}`,
              title: movie.title,
              posterPath: movie.poster_path,
              type: 'released',
              message: `Now available! Released on ${details.release_date}`,
              date: details.release_date,
              mediaType: 'movie',
            };
          }

          return null;
        } catch {
          return null;
        }
      });

      const tvPromises = tvShows.map(async (show) => {
        try {
          const details = await window.electron?.tmdb?.fetch(`/tv/${show.tmdb_id}`);
          if (!details) return null;

          const updates = [];
          const now = new Date();

          if (details.last_episode_to_air) {
            const epDate = new Date(details.last_episode_to_air.air_date);
            const daysAgo = Math.ceil((now - epDate) / (1000 * 60 * 60 * 24));
            if (daysAgo <= 7) {
              updates.push({
                id: `tv-ep-${show.tmdb_id}-s${details.last_episode_to_air.season_number}e${details.last_episode_to_air.episode_number}`,
                mediaId: `${show.type}-${show.tmdb_id}`,
                title: show.title,
                posterPath: show.poster_path,
                type: 'new_episode',
                message: `New episode: S${details.last_episode_to_air.season_number}E${details.last_episode_to_air.episode_number} - ${details.last_episode_to_air.name}`,
                date: details.last_episode_to_air.air_date,
                mediaType: 'tv',
              });
            }
          }

          if (details.next_episode_to_air) {
            const epDate = new Date(details.next_episode_to_air.air_date);
            const daysUntil = Math.ceil((epDate - now) / (1000 * 60 * 60 * 24));
            if (daysUntil > 0 && daysUntil <= 14) {
              updates.push({
                id: `tv-next-${show.tmdb_id}-s${details.next_episode_to_air.season_number}e${details.next_episode_to_air.episode_number}`,
                mediaId: `${show.type}-${show.tmdb_id}`,
                title: show.title,
                posterPath: show.poster_path,
                type: 'upcoming_episode',
                message: `Next episode in ${daysUntil} days: S${details.next_episode_to_air.season_number}E${details.next_episode_to_air.episode_number}`,
                date: details.next_episode_to_air.air_date,
                mediaType: 'tv',
              });
            }
          }

          if (details.seasons && Array.isArray(details.seasons)) {
            const recentSeasons = details.seasons.filter((s) => {
              if (!s.air_date) return false;
              const airDate = new Date(s.air_date);
              const daysDiff = Math.ceil((airDate - now) / (1000 * 60 * 60 * 24));
              return daysDiff > -30 && daysDiff <= 30;
            });

            for (const season of recentSeasons) {
              const airDate = new Date(season.air_date);
              const daysDiff = Math.ceil((airDate - now) / (1000 * 60 * 60 * 24));

              if (daysDiff > 0 && daysDiff <= 30) {
                updates.push({
                  id: `tv-season-upcoming-${show.tmdb_id}-s${season.season_number}`,
                  mediaId: `${show.type}-${show.tmdb_id}`,
                  title: show.title,
                  posterPath: show.poster_path,
                  type: 'upcoming_season',
                  message: `Season ${season.season_number} premieres in ${daysDiff} days (${season.air_date})`,
                  date: season.air_date,
                  mediaType: 'tv',
                });
              } else if (daysDiff <= 0 && daysDiff > -7) {
                updates.push({
                  id: `tv-season-new-${show.tmdb_id}-s${season.season_number}`,
                  mediaId: `${show.type}-${show.tmdb_id}`,
                  title: show.title,
                  posterPath: show.poster_path,
                  type: 'new_season',
                  message: `Season ${season.season_number} just released! (${season.air_date})`,
                  date: season.air_date,
                  mediaType: 'tv',
                });
              }
            }
          }

          return updates;
        } catch {
          return [];
        }
      });

      const movieResults = (await Promise.all(moviePromises)).filter(Boolean);
      const tvResults = (await Promise.all(tvPromises)).flat().filter(Boolean);

      setMovieUpdates(movieResults);
      setTvUpdates(tvResults);
      setHasCached(true);
    } catch (err) {
      setError(err.message || 'Failed to load updates');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUpdates(retryCount > 0);
  }, [retryCount, profileId]);

  const systemUpdates = [
    {
      id: 'sys-1',
      title: 'Progress Tracking',
      message: 'Track your watch progress across all devices. Coming soon!',
      date: new Date().toISOString(),
      type: 'feature',
      icon: 'Sparkles',
    },
    {
      id: 'sys-2',
      title: 'Download Manager',
      message: 'Download movies and shows for offline viewing. In development.',
      date: new Date().toISOString(),
      type: 'feature',
      icon: 'Calendar',
    },
  ];

  const hasAnyContent =
    activeTab === 'updates' ||
    (activeTab === 'movies' && movieUpdates.length > 0) ||
    (activeTab === 'tv' && tvUpdates.length > 0);

  if (loading && !hasCached) {
    return <LoadingScreen message="Loading notifications..." />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-xl text-center">
        <span className="text-4xl mb-md"></span>
        <h2 className="text-lg font-bold text-text-primary mb-sm">Failed to load notifications</h2>
        <p className="text-sm text-text-muted mb-lg max-w-sm">{error}</p>
        <button onClick={() => setRetryCount((c) => c + 1)} className="btn-primary">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="px-lg py-lg max-w-2xl">
      <div className="flex items-center justify-between mb-lg">
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-sm">
          <Bell className="w-6 h-6" />
          Notifications
        </h1>
      </div>

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

      {activeTab === 'updates' && (
        <div className="space-y-md">
          {systemUpdates.map((update) => (
            <div
              key={update.id}
              className="p-md bg-surface rounded-card border border-border"
            >
              <div className="flex items-start gap-md">
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                  {update.icon === 'Sparkles' ? (
                    <Sparkles className="w-5 h-5 text-accent" />
                  ) : (
                    <Calendar className="w-5 h-5 text-accent" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-text-primary mb-xs">{update.title}</h3>
                  <p className="text-sm text-text-muted">{update.message}</p>
                  <span className="inline-block mt-sm px-xs py-2xs rounded text-xs bg-accent/10 text-accent">
                    Coming Soon
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'movies' && (
        movieUpdates.length === 0 ? (
          <div className="flex flex-col items-center text-center py-xl text-text-muted">
            <Film className="w-12 h-12 mb-md" />
            <p className="text-lg">No movie updates</p>
            <p className="text-sm mt-sm">Favorite movies to get notified about releases</p>
          </div>
        ) : (
          <div className="space-y-md">
            {movieUpdates.map((update) => (
              <div
                key={update.id}
                className="p-md bg-surface rounded-card border border-border group cursor-pointer hover:bg-surface-hover transition-colors"
                onClick={() => onSelect?.({ id: update.mediaId, tmdbId: update.mediaId.split('-')[1], type: 'movie', title: update.title, posterPath: update.posterPath })}
              >
                <div className="flex items-start gap-md">
                  {update.type === 'released' && update.posterPath ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w92${update.posterPath}`}
                      alt={update.title}
                      className="w-18 h-24 rounded object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-5 h-5 text-accent" />
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-medium text-text-primary mb-xs">{update.title}</h3>
                    <p className="text-sm text-text-muted">{update.message}</p>
                    <span className={`inline-block mt-sm px-xs py-2xs rounded text-xs ${
                      update.type === 'released' ? 'bg-success/10 text-success' : 'bg-accent/10 text-accent'
                    }`}>
                      {update.type === 'released' ? 'Now Available' : 'Upcoming'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {activeTab === 'tv' && (
        tvUpdates.length === 0 ? (
          <div className="flex flex-col items-center text-center py-xl text-text-muted">
            <Tv className="w-12 h-12 mb-md" />
            <p className="text-lg">No TV updates</p>
            <p className="text-sm mt-sm">Favorite TV series to get notified about new episodes</p>
          </div>
        ) : (
          <div className="space-y-md">
            {tvUpdates.map((update) => (
              <div
                key={update.id}
                className="p-md bg-surface rounded-card border border-border group cursor-pointer hover:bg-surface-hover transition-colors"
                onClick={() => onSelect?.({ id: update.mediaId, tmdbId: update.mediaId.split('-')[1], type: 'tv', title: update.title, posterPath: update.posterPath })}
              >
                <div className="flex items-start gap-md">
                  {(update.type === 'new_episode' || update.type === 'new_season') && update.posterPath ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w92${update.posterPath}`}
                      alt={update.title}
                      className="w-18 h-24 rounded object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-5 h-5 text-accent" />
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-medium text-text-primary mb-xs">{update.title}</h3>
                    <p className="text-sm text-text-muted">{update.message}</p>
                    <span className={`inline-block mt-sm px-xs py-2xs rounded text-xs ${
                      update.type === 'new_episode' || update.type === 'new_season'
                        ? 'bg-success/10 text-success'
                        : 'bg-accent/10 text-accent'
                    }`}>
                      {update.type === 'new_episode'
                        ? 'New Episode'
                        : update.type === 'upcoming_episode'
                          ? 'Upcoming Episode'
                          : update.type === 'new_season'
                            ? 'New Season'
                            : 'Upcoming Season'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

export default NotificationView;
