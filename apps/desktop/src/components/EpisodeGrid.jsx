import { useState, useEffect, useRef } from 'react';
import { Play, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

const EPISODES_PER_PAGE = 32;

export default function EpisodeGrid({
  seasons,
  selectedSeason,
  episodes,
  onSeasonChange,
  onPlayEpisode,
}) {
  const [episodePage, setEpisodePage] = useState(1);
  const [showPageDropdown, setShowPageDropdown] = useState(false);
  const pageDropdownRef = useRef(null);

  useEffect(() => {
    setEpisodePage(1);
  }, [selectedSeason]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pageDropdownRef.current && !pageDropdownRef.current.contains(e.target)) {
        setShowPageDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (seasons.length === 0) return null;

  const totalEpisodePages = Math.ceil(episodes.length / EPISODES_PER_PAGE);
  const pagedEpisodes = episodes.slice((episodePage - 1) * EPISODES_PER_PAGE, episodePage * EPISODES_PER_PAGE);

  return (
    <div className="mt-2xl pt-xl border-t border-border/50">
      <h2 className="text-lg font-bold text-text-primary mb-md">Episodes</h2>
      {seasons.length > 1 && (
        <div className="flex gap-sm mb-md">
          {seasons.map((s) => (
            <button
              key={s.season_number}
              onClick={() => onSeasonChange(s.season_number)}
              className={`px-md py-sm rounded-button text-sm transition-colors ${
                selectedSeason === s.season_number
                  ? 'bg-accent text-background'
                  : 'bg-surface text-text-muted hover:text-text-primary'
              }`}
            >
              Season {s.season_number}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-md">
        {pagedEpisodes.map((ep) => (
          <div
            key={ep.id}
            className="group cursor-pointer"
            onClick={() => onPlayEpisode(ep)}
          >
            <div className="relative aspect-video bg-surface rounded-card overflow-hidden mb-2xs">
              {ep.still_path ? (
                <img
                  src={`https://image.tmdb.org/t/p/w185${ep.still_path}`}
                  alt={ep.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Play className="w-6 h-6 text-text-muted" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-accent/90 flex items-center justify-center">
                  <Play className="w-4 h-4 text-background ml-0.5" />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2xs">
              <span className="text-xs font-medium text-accent">E{ep.episode_number}</span>
              <h3 className="text-xs font-medium text-text-primary truncate">{ep.name}</h3>
            </div>
            {ep.air_date && <p className="text-xs text-text-muted mt-2xs">{new Date(ep.air_date).toLocaleDateString()}</p>}
          </div>
        ))}
      </div>
      {totalEpisodePages > 1 && (
        <div className="flex items-center justify-between mt-md">
          <button
            onClick={() => setEpisodePage((p) => Math.max(1, p - 1))}
            disabled={episodePage === 1}
            className="flex items-center gap-sm px-md py-sm bg-surface hover:bg-surface-hover rounded-button text-text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>
          <div className="relative" ref={pageDropdownRef}>
            <button
              onClick={() => setShowPageDropdown(!showPageDropdown)}
              className="flex items-center gap-sm px-md py-sm bg-surface hover:bg-surface-hover rounded-button text-text-primary transition-colors"
            >
              Page {episodePage} of {totalEpisodePages}
              <ChevronDown className="w-4 h-4" />
            </button>
            {showPageDropdown && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-sm w-48 bg-surface border border-border rounded-lg shadow-lg overflow-hidden z-50 max-h-64 overflow-y-auto">
                {Array.from({ length: totalEpisodePages }, (_, i) => i + 1).map((p) => {
                  const startEp = (p - 1) * EPISODES_PER_PAGE + 1;
                  const endEp = Math.min(p * EPISODES_PER_PAGE, episodes.length);
                  return (
                    <button
                      key={p}
                      onClick={() => {
                        setEpisodePage(p);
                        setShowPageDropdown(false);
                      }}
                      className={`w-full px-md py-sm text-left text-sm transition-colors group relative ${
                        episodePage === p
                          ? 'bg-accent/10 text-accent'
                          : 'text-text-primary hover:bg-surface-hover'
                      }`}
                    >
                      Page {p}
                      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-sm px-sm py-2xs bg-surface border border-border rounded text-xs text-text-muted whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                        E{startEp} - E{endEp}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <button
            onClick={() => setEpisodePage((p) => Math.min(totalEpisodePages, p + 1))}
            disabled={episodePage >= totalEpisodePages}
            className="flex items-center gap-sm px-md py-sm bg-surface hover:bg-surface-hover rounded-button text-text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
