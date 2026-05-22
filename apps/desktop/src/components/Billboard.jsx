import { Play, Info, Star } from 'lucide-react';

function Billboard({ media, onPlay, onInfo }) {
  if (!media) return null;

  return (
    <div className="relative h-[500px] w-full overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(https://image.tmdb.org/t/p/w1280${media.backdropPath})`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/80 to-transparent" />

      <div className="relative h-full flex flex-col justify-end px-xl pb-xl max-w-2xl">
        <h1 className="text-4xl font-bold text-text-primary mb-sm">
          {media.title}
        </h1>
        {media.tagline && (
          <p className="text-text-muted mb-md">{media.tagline}</p>
        )}
        <p className="text-text-primary/80 line-clamp-3 mb-lg">
          {media.overview}
        </p>

        <div className="flex items-center gap-md">
          <button
            onClick={() => onPlay?.(media)}
            className="btn-primary flex items-center gap-sm"
          >
            <Play className="w-4 h-4" />
            Play
          </button>
          <button
            onClick={() => onInfo?.(media)}
            className="btn-secondary flex items-center gap-sm"
          >
            <Info className="w-4 h-4" />
            More Info
          </button>
        </div>

        <div className="flex items-center gap-md mt-md text-sm text-text-muted">
          {media.voteAverage > 0 && (
            <span className="flex items-center gap-2xs text-success font-medium">
              <Star className="w-3 h-3 fill-current" />
              {media.voteAverage.toFixed(1)}
            </span>
          )}
          {media.releaseDate && (
            <span>{new Date(media.releaseDate).getFullYear()}</span>
          )}
          {media.runtime && <span>{media.runtime} min</span>}
          {media.genres?.slice(0, 3).map((g) => (
            <span key={g.id}>{g.name}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Billboard;
