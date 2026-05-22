import { Play, X } from 'lucide-react';

export default function TrailerList({ videos, onSelect, onClose }) {
  if (!videos || videos.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={onClose}>
      <div className="w-full max-w-lg bg-surface rounded-card border border-border shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-lg py-md border-b border-border">
          <h2 className="text-lg font-bold text-text-primary">Trailers</h2>
          <button onClick={onClose} className="p-sm text-text-muted hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-md max-h-80 overflow-y-auto">
          {videos.map((video) => (
            <button
              key={video.id}
              onClick={() => onSelect(video.key)}
              className="w-full flex items-center gap-md p-md bg-surface-hover hover:bg-border rounded-card transition-colors text-left"
            >
              <div className="w-24 aspect-video rounded overflow-hidden flex-shrink-0">
                <img
                  src={`https://img.youtube.com/vi/${video.key}/hqdefault.jpg`}
                  alt={video.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{video.name}</p>
                <p className="text-xs text-text-muted mt-2xs">{video.site}</p>
              </div>
              <Play className="w-5 h-5 text-accent flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
