import { useState, useEffect, useCallback } from 'react';
import { Search } from 'lucide-react';

function SearchOverlay({ query, onQueryChange, onClose, onSelect }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useState(null);

  const search = useCallback(async (q) => {
    if (!q || q.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const data = await window.electron?.tmdb?.fetch('/search/multi', { query: q });
      if (data?.results) {
        const filtered = data.results
          .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
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
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  return (
    <div className="fixed inset-0 bg-overlay backdrop-blur-overlay z-40 flex flex-col">
      <div className="flex items-center gap-md px-xl py-lg border-b border-border">
        <Search className="w-6 h-6 text-text-muted" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search movies, TV shows..."
          className="flex-1 bg-transparent text-xl text-text-primary placeholder-text-muted outline-none"
        />
        <button
          onClick={onClose}
          className="px-md py-sm text-text-muted hover:text-text-primary transition-colors"
        >
          ESC
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-xl py-lg">
        {loading && (
          <div className="flex items-center justify-center h-32 text-text-muted">
            Searching...
          </div>
        )}

        {!loading && results.length === 0 && query.length >= 2 && (
          <div className="flex items-center justify-center h-32 text-text-muted">
            No results found
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-md">
          {results.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelect(item)}
              className="cursor-pointer group"
            >
              <div className="aspect-[2/3] rounded-card overflow-hidden bg-surface mb-sm">
                <img
                  src={
                    item.posterPath
                      ? `https://image.tmdb.org/t/p/w342${item.posterPath}`
                      : 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="342" height="513" fill="%2312121A"></svg>'
                  }
                  alt={item.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
              </div>
              <h3 className="text-sm font-medium text-text-primary truncate group-hover:text-accent transition-colors">
                {item.title}
              </h3>
              <p className="text-xs text-text-muted">
                {item.type === 'movie' ? 'Movie' : 'TV Show'}
                {item.releaseDate && ` • ${new Date(item.releaseDate).getFullYear()}`}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SearchOverlay;
