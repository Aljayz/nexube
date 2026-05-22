import { Play, X, Film } from 'lucide-react';

const TYPE_COLORS = {
  Trailer: 'bg-accent/15 text-accent',
  Teaser: 'bg-blue-500/15 text-blue-400',
  Clip: 'bg-green-500/15 text-green-400',
  'Behind the Scenes': 'bg-yellow-500/15 text-yellow-400',
  Featurette: 'bg-purple-500/15 text-purple-400',
};

function getTypeBadge(type) {
  const cls = TYPE_COLORS[type] || 'bg-surface-hover text-text-muted';
  return (
    <span className={`inline-block px-sm py-2xs rounded-full text-[11px] font-medium ${cls}`}>
      {type || 'Video'}
    </span>
  );
}

export default function TrailerList({ videos, onSelect, onClose }) {
  if (!videos || videos.length === 0) return null;

  const grouped = { Official: [], Other: [] };
  for (const v of videos) {
    if (v.type === 'Trailer' || v.type === 'Teaser') {
      grouped.Official.push(v);
    } else {
      grouped.Other.push(v);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={onClose}>
      <div className="w-full max-w-xl bg-surface rounded-xl border border-border shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-xl py-lg border-b border-border">
          <div className="flex items-center gap-sm">
            <Film className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-bold text-text-primary">Trailers & Videos</h2>
            <span className="text-xs text-text-muted bg-surface-hover px-sm py-2xs rounded-full">{videos.length}</span>
          </div>
          <button onClick={onClose} className="p-sm text-text-muted hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-xl space-y-xl max-h-[70vh] overflow-y-auto">
          {grouped.Official.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-md">Official</h3>
              <div className="space-y-md">
                {grouped.Official.map((video) => (
                  <button
                    key={video.id}
                    onClick={() => onSelect(video.key)}
                    className="w-full flex items-start gap-lg p-lg bg-surface-hover hover:bg-border/80 rounded-xl transition-all duration-200 text-left group"
                  >
                    <div className="relative w-40 aspect-video rounded-lg overflow-hidden flex-shrink-0 shadow-md">
                      <img
                        src={`https://img.youtube.com/vi/${video.key}/hqdefault.jpg`}
                        alt={video.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                          <Play className="w-5 h-5 text-background ml-0.5" />
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 pt-xs">
                      <div className="flex items-center gap-sm mb-xs">
                        {getTypeBadge(video.type)}
                        <span className="text-[11px] text-text-muted">{video.site}</span>
                      </div>
                      <p className="text-sm font-medium text-text-primary leading-snug line-clamp-2">{video.name}</p>
                      {video.published_at && (
                        <p className="text-xs text-text-muted mt-sm">
                          {new Date(video.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {grouped.Other.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-md">More Videos</h3>
              <div className="space-y-md">
                {grouped.Other.map((video) => (
                  <button
                    key={video.id}
                    onClick={() => onSelect(video.key)}
                    className="w-full flex items-start gap-lg p-lg bg-surface-hover hover:bg-border/80 rounded-xl transition-all duration-200 text-left group"
                  >
                    <div className="relative w-36 aspect-video rounded-lg overflow-hidden flex-shrink-0 shadow-sm">
                      <img
                        src={`https://img.youtube.com/vi/${video.key}/hqdefault.jpg`}
                        alt={video.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-8 h-8 rounded-full bg-accent/80 flex items-center justify-center">
                          <Play className="w-4 h-4 text-background ml-0.5" />
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 pt-xs">
                      <div className="flex items-center gap-sm mb-xs">
                        {getTypeBadge(video.type)}
                        <span className="text-[11px] text-text-muted">{video.site}</span>
                      </div>
                      <p className="text-sm text-text-primary leading-snug line-clamp-2">{video.name}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
