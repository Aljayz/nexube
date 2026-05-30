import { Fragment } from 'react';
import { Play } from 'lucide-react';

export default function OfflineEpisodeGrid({ items, currentEpisodeId, onPlay }) {
  const seasons = [...new Set(items.map((d) => d.season).filter((s) => s != null))].sort((a, b) => a - b);

  return (
    <div className="mt-2xl pt-xl border-t border-border/50">
      <h2 className="text-lg font-bold text-text-primary mb-md">Episodes</h2>
      {seasons.map((season) => {
        const seasonEps = items
          .filter((d) => d.season === season)
          .sort((a, b) => a.episode - b.episode);
        return (
          <Fragment key={season}>
            <h3 className="text-sm font-semibold text-text-muted mb-sm">Season {season}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-md mb-lg">
              {seasonEps.map((ep) => {
                const isActive = ep.id === currentEpisodeId;
                return (
                  <div
                    key={ep.id}
                    className={`group cursor-pointer ${isActive ? 'ring-2 ring-accent rounded-card' : ''}`}
                    onClick={() => onPlay(ep)}
                  >
                    <div className="relative aspect-video bg-surface rounded-card overflow-hidden mb-2xs">
                      <div className="w-full h-full flex items-center justify-center">
                        <Play className="w-6 h-6 text-text-muted" />
                      </div>
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-accent/90 flex items-center justify-center">
                          <Play className="w-4 h-4 text-background ml-0.5" />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2xs">
                      <span className="text-xs font-medium text-accent">E{ep.episode}</span>
                      <h3 className="text-xs font-medium text-text-primary truncate">{ep.episode_name || ''}</h3>
                    </div>
                  </div>
                );
              })}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
