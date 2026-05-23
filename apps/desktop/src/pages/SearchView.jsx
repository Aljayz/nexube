import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X, Clock, Trash2, Star, Film, Tv } from 'lucide-react';
import MediaCard from '../components/MediaCard';

const MAX_HISTORY = 12;

function getHistoryKey(profileId) {
  return `searchHistory_${profileId}`;
}

function loadHistory(profileId) {
  try {
    const saved = localStorage.getItem(getHistoryKey(profileId));
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveHistory(profileId, history) {
  try {
    localStorage.setItem(getHistoryKey(profileId), JSON.stringify(history));
  } catch {}
}

export function getSearchHistory(profileId) {
  return loadHistory(profileId);
}

function SearchView({ query, onQueryChange, onClose, onSelect, activeProfile }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState(() => loadHistory(activeProfile?.id));
  const [isLargeScreen, setIsLargeScreen] = useState(() => window.innerWidth >= 1024);
  const inputRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setIsLargeScreen(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const search = useCallback(async (q) => {
    if (!q || q.length < 2) {
      setResults([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await window.electron?.tmdb?.fetch('/search/multi', { query: q, kidsMode: activeProfile?.isKids });

      if (!data) {
        throw new Error('No response from TMDB API');
      }

      if (data?.results) {
        const filtered = data.results
          .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
          .slice(0, 24)
          .map((r) => ({
            id: `${r.media_type}-${r.id}`,
            tmdbId: r.id,
            title: r.title || r.name,
            type: r.media_type,
            posterPath: r.poster_path,
            backdropPath: r.backdrop_path,
            overview: r.overview,
            releaseDate: r.release_date || r.first_air_date,
            voteAverage: r.vote_average,
            voteCount: r.vote_count,
            popularity: r.popularity,
            originalLanguage: r.original_language,
            genreIds: r.genre_ids || [],
            isAnime: r.original_language === 'ja' && r.genre_ids?.includes(16),
          }));
        setResults(filtered);
      } else {
        throw new Error('Invalid search results format');
      }
    } catch (err) {
      setError(err.message || 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  const addToHistory = useCallback((term) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    const pid = activeProfile?.id;
    setHistory((prev) => {
      const next = [trimmed, ...prev.filter((h) => h !== trimmed)].slice(0, MAX_HISTORY);
      saveHistory(pid, next);
      return next;
    });
  }, [activeProfile?.id]);

  const removeFromHistory = useCallback((e, term) => {
    e.stopPropagation();
    const pid = activeProfile?.id;
    setHistory((prev) => {
      const next = prev.filter((h) => h !== term);
      saveHistory(pid, next);
      return next;
    });
  }, [activeProfile?.id]);

  const clearHistory = useCallback(() => {
    const pid = activeProfile?.id;
    setHistory([]);
    saveHistory(pid, []);
  }, [activeProfile?.id]);

  const handleSelect = (item) => {
    const trimmed = query.trim();
    if (trimmed) addToHistory(trimmed);
    onSelect(item);
  };

  const handleHistoryClick = (term) => {
    onQueryChange(term);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && query.trim()) addToHistory(query);
  };

  const showHistory = !query && history.length > 0;
  const showHint = !query && history.length === 0;

  const LoadingSkeleton = () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-md">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-[2/3] bg-surface rounded-card mb-sm" />
          <div className="h-4 bg-surface rounded w-3/4 mb-xs" />
          <div className="h-3 bg-surface rounded w-1/2" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-overlay backdrop-blur-overlay z-50 flex justify-center pt-20 p-lg" onClick={onClose}>
      <div
        className="w-full max-w-3xl lg:max-w-4xl max-h-[70vh] bg-surface rounded-xl border border-border shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-md px-lg py-md border-b border-border flex-shrink-0">
          <Search className="w-5 h-5 text-text-muted" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search movies and series..."
            className="flex-1 bg-transparent text-lg text-text-primary placeholder-text-muted outline-none"
            autoFocus
          />
          {query ? (
            <button
              onClick={() => onQueryChange('')}
              className="p-sm text-text-muted hover:text-text-primary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-sm py-2xs text-xs text-text-muted hover:text-text-primary border border-border rounded transition-colors"
            >
              ESC
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-lg py-lg lg:px-lg lg:py-lg">
        {loading && <LoadingSkeleton />}

        {error && !loading && (
          <div className="flex flex-col items-center justify-center h-32 text-text-muted">
            <p>{error}</p>
            <button onClick={() => search(query)} className="mt-sm text-accent hover:underline text-sm">
              Try again
            </button>
          </div>
        )}

        {!loading && !error && results.length === 0 && query.length >= 2 && (
          <div className="flex flex-col items-center justify-center h-32 text-text-muted">
            <p>No results found for "{query}"</p>
            <p className="text-sm mt-xs">Try different keywords or check your spelling</p>
          </div>
        )}

        {!loading && !error && results.length === 0 && query.length < 2 && showHistory && (
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-md">
              <div className="flex items-center gap-sm text-text-muted">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">Recent searches</span>
              </div>
              <button
                onClick={clearHistory}
                className="flex items-center gap-sm text-xs text-text-muted hover:text-danger transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                Clear all
              </button>
            </div>
            <div className="flex flex-wrap gap-sm">
              {history.map((term) => (
                <div
                  key={term}
                  className="group flex items-center gap-sm px-md py-sm bg-surface hover:bg-surface-hover border border-border rounded-full cursor-pointer transition-colors"
                  onClick={() => handleHistoryClick(term)}
                >
                  <Search className="w-3 h-3 text-text-muted" />
                  <span className="text-sm text-text-primary">{term}</span>
                  <button
                    onClick={(e) => removeFromHistory(e, term)}
                    className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger transition-all"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && !error && results.length === 0 && query.length < 2 && showHint && (
          <div className="flex flex-col items-center justify-center h-32 text-text-muted">
            <Search className="w-8 h-8 mb-sm opacity-50" />
            <p className="text-sm">Search for movies and series</p>
            <p className="text-xs mt-xs">Press <kbd className="px-xs py-2xs bg-surface border border-border rounded text-xs">ESC</kbd> to close</p>
          </div>
        )}

        {!loading && !error && results.length > 0 && (
          <>
            {isLargeScreen ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-md">
                {results.map((item) => (
                  <div key={item.id} onClick={() => handleSelect(item)} className="cursor-pointer group">
                    <MediaCard
                      key={item.id}
                      media={item}
                      onClick={() => {}}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-sm">
                {results.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    className="flex items-center gap-md p-md bg-surface-hover hover:bg-border rounded-card cursor-pointer transition-colors group"
                  >
                    <div className="w-12 h-16 flex-shrink-0 rounded overflow-hidden bg-surface">
                      {item.posterPath ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w92${item.posterPath}`}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          {item.type === 'tv' ? <Tv className="w-5 h-5 text-text-muted" /> : <Film className="w-5 h-5 text-text-muted" />}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-text-primary truncate group-hover:text-accent transition-colors">{item.title}</h3>
                      <div className="flex items-center gap-md mt-2xs text-xs text-text-muted">
                        {item.releaseDate && <span>{new Date(item.releaseDate).getFullYear()}</span>}
                        {item.voteAverage > 0 && (
                          <span className="flex items-center gap-2xs text-success">
                            <Star className="w-3 h-3 fill-current" />
                            {item.voteAverage.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={`flex items-center gap-2xs text-xs px-xs py-2xs rounded flex-shrink-0 ${
                      item.type === 'tv' ? 'bg-accent/10 text-accent' : 'bg-surface-hover text-text-muted'
                    }`}>
                      {item.type === 'tv' ? <Tv className="w-3 h-3" /> : <Film className="w-3 h-3" />}
                      {item.type === 'tv' ? 'Series' : 'Movie'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  </div>
);
}

export default SearchView;
