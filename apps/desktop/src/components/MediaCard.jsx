import { Play, Star, CheckCircle } from 'lucide-react';

function MediaCard({ media, onClick, showProgress = false, progress = 0, showWatched = false }) {
  const imageUrl = media.posterPath
    ? `https://image.tmdb.org/t/p/w342${media.posterPath}`
    : 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="342" height="513" fill="%2312121A"><rect width="342" height="513"/><text x="50%" y="50%" fill="%238A8A9E" text-anchor="middle" dy=".3em">No Image</text></svg>';

  return (
    <div
      className="media-card flex-shrink-0 w-[185px] group relative z-0 hover:z-10"
      onClick={() => onClick?.(media)}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-card bg-surface">
        <img
          src={imageUrl}
          alt={media.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        <div className="absolute top-sm right-sm flex items-center gap-xs">
          {media.certification && (
            <span className="px-xs py-2xs bg-surface-hover rounded text-xs text-text-primary font-medium">
              {media.certification}
            </span>
          )}
          {media.mediaType && (
            <span className="px-xs py-2xs bg-accent/20 rounded text-xs text-accent font-medium uppercase">
              {media.mediaType}
            </span>
          )}
        </div>
        {media.adult && (
          <div className="absolute top-sm left-sm px-xs py-2xs bg-danger/80 rounded text-xs text-background font-bold">
            18+
          </div>
        )}

        {showWatched && (
          <div className="absolute top-sm left-sm">
            <CheckCircle className="w-4 h-4 text-success" />
          </div>
        )}

        {showProgress && progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-surface">
            <div
              className="h-full bg-accent transition-all duration-300"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        )}

        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="w-12 h-12 rounded-full bg-accent/90 flex items-center justify-center">
            <Play className="w-6 h-6 text-background ml-0.5" />
          </div>
        </div>
      </div>

      <div className="mt-sm px-xs">
        <h3 className="text-sm font-medium text-text-primary truncate group-hover:text-accent transition-colors">
          {media.title}
        </h3>
        <div className="flex items-center gap-xs mt-2xs text-xs text-text-muted">
          {media.voteAverage > 0 && (
            <span className="flex items-center gap-2xs text-success">
              <Star className="w-3 h-3 fill-current" />
              {media.voteAverage.toFixed(1)}
            </span>
          )}
          {media.releaseDate && (
            <span>{new Date(media.releaseDate).getFullYear()}</span>
          )}
          {media.season != null && media.episode != null && (
            <span className="text-accent">S{media.season}E{media.episode}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default MediaCard;
