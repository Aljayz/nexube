import { Heart, HeartOff, Plus, Check, Download, ChevronLeft, Play, Film } from 'lucide-react';
import { getResumeSeconds } from '@nexube/player-engine';
import { buildMediaData } from '../hooks/useDetailData';

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${total}s`;
}

// Saved rows from SQLite use snake_case; live progress from the player uses
// camelCase. Delegate the thresholds and episode matching to player-engine so
// the label never promises a resume the generated URL won't do.
function getResumeState(savedProgress, type) {
  if (!savedProgress) return { canResume: false, seconds: 0, season: null, episode: null };

  const season = Number(savedProgress.season);
  const episode = Number(savedProgress.episode);
  const seconds = getResumeSeconds(savedProgress, {
    type,
    season: Number.isFinite(season) && season > 0 ? season : undefined,
    episode: Number.isFinite(episode) && episode > 0 ? episode : undefined,
  });

  return {
    canResume: seconds > 0,
    seconds,
    season: Number.isFinite(season) ? season : null,
    episode: Number.isFinite(episode) ? episode : null,
  };
}

export default function MediaHero({
  details,
  videos,
  isFavorite,
  isSaved,
  savedProgress,
  onBack,
  onPlay,
  onToggleFavorite,
  onToggleSaved,
  onShowTrailerList,
  onShowDownload,
  isUnreleased,
}) {
  const backdropUrl = details?.backdropPath ? `https://image.tmdb.org/t/p/w1280${details.backdropPath}` : '';
  const posterUrl = details?.posterPath ? `https://image.tmdb.org/t/p/w780${details.posterPath}` : '';
  const resume = getResumeState(savedProgress, details?.type);
  const resumeLabel = resume.canResume
    ? `Resume${details?.type === 'tv' ? ` S${resume.season}E${resume.episode}` : ''} at ${formatTime(resume.seconds)}`
    : 'Play';

  return (
    <div className="relative h-[600px]">
      {backdropUrl && (
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${backdropUrl})` }} />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/40" />

      <button
        onClick={onBack}
        className="flex items-center gap-sm absolute top-lg left-lg px-md py-sm bg-surface/80 hover:bg-surface rounded-button text-text-primary transition-colors z-10"
      >
        <ChevronLeft className="w-4 h-4" />
        <span>Back</span>
      </button>

      <div className="absolute bottom-0 left-0 right-0 px-xl pb-lg flex gap-lg">
        <div className="w-[200px] flex-shrink-0 -mb-16 relative z-10">
          <div className="rounded-card overflow-hidden shadow-xl">
            <img
              src={posterUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300" fill="%2312121A"></svg>'}
              alt={details?.title}
              className="w-full"
            />
          </div>
        </div>

        <div className="flex-1 pt-xl">
          <h1 className="text-3xl font-bold text-text-primary mb-sm">{details?.title}</h1>
          {details?.tagline && <p className="text-text-muted italic mb-md">{details.tagline}</p>}

          <div className="flex items-center gap-md mb-md text-sm">
            {details?.voteAverage > 0 && <span className="text-success font-medium">{details.voteAverage.toFixed(1)}</span>}
            {details?.certification && <span className="px-xs py-2xs bg-surface-hover rounded text-xs font-medium text-text-primary">{details.certification}</span>}
            {details?.releaseDate && <span>{new Date(details.releaseDate).getFullYear()}</span>}
            {details?.runtime && <span>{details.runtime} min</span>}
            {details?.type === 'tv' && <span>{details.numberOfSeasons} Seasons</span>}
          </div>

          <div className="flex flex-wrap gap-xs mb-lg">
            {details?.genres?.map((g) => (
              <span key={g.id} className="px-sm py-2xs bg-surface-hover rounded-full text-xs text-text-muted">
                {g.name}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-md flex-wrap">
            {!isUnreleased && (
            <button onClick={() => onPlay()} className="btn-primary flex items-center gap-sm">
              <Play className="w-4 h-4" />
              {resumeLabel}
            </button>
            )}
            {videos.length > 0 && (
              <button
                onClick={() => videos.length === 1 ? onShowTrailerList?.(videos[0].key) : onShowTrailerList?.()}
                className="btn-secondary flex items-center gap-sm"
              >
                <Film className="w-4 h-4" />
                Trailer
              </button>
            )}
            <button
              onClick={onToggleFavorite}
              className={`btn-secondary flex items-center gap-sm ${isFavorite ? 'text-accent border-accent' : ''}`}
            >
              {isFavorite ? <Heart className="w-4 h-4 fill-current" /> : <HeartOff className="w-4 h-4" />}
              Favorite
            </button>
            <button
              onClick={onToggleSaved}
              className={`btn-secondary flex items-center gap-sm ${isSaved ? 'text-accent border-accent' : ''}`}
            >
              {isSaved ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              Watchlist
            </button>
            {!isUnreleased && (
            <button onClick={() => onShowDownload(true)} className="btn-secondary flex items-center gap-sm">
              <Download className="w-4 h-4" />
              Download
            </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
