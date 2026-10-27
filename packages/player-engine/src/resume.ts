export interface WatchProgressLike {
  progress_seconds?: number | string | null;
  progressSeconds?: number | null;
  currentTime?: number | null;
  progress_percent?: number | string | null;
  progressPercent?: number | null;
  percent?: number | null;
  duration?: number | string | null;
  season?: number | string | null;
  episode?: number | string | null;
}

export interface ResumeTarget {
  type?: 'movie' | 'tv';
  season?: number | null;
  episode?: number | null;
}

const MIN_RESUME_SECONDS = 5;
const COMPLETED_PERCENT = 95;
const END_CREDITS_SECONDS = 10;

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Returns the number of seconds to resume playback from, or 0 when resuming
 * would be wrong (different episode, almost finished, or no usable progress).
 */
export function getResumeSeconds(
  progress: WatchProgressLike | null | undefined,
  target: ResumeTarget = {},
): number {
  if (!progress) return 0;

  const seconds = toNumber(
    progress.progress_seconds ?? progress.progressSeconds ?? progress.currentTime,
  );
  if (seconds === null || seconds < MIN_RESUME_SECONDS) return 0;

  const duration = toNumber(progress.duration) ?? 0;
  if (duration > 0 && duration - seconds <= END_CREDITS_SECONDS) return 0;

  const percent =
    toNumber(progress.progress_percent ?? progress.progressPercent ?? progress.percent) ?? 0;
  if (percent >= COMPLETED_PERCENT) return 0;

  if (target.type === 'tv') {
    const savedSeason = toNumber(progress.season);
    const savedEpisode = toNumber(progress.episode);

    // Without saved episode info (legacy rows), resuming could start the wrong
    // episode. Only resume when we know the exact episode.
    if (savedSeason === null || savedEpisode === null) return 0;
    if (target.episode == null) return 0;
    if (target.season != null && savedSeason !== Number(target.season)) return 0;
    if (savedEpisode !== Number(target.episode)) return 0;
  }

  return Math.floor(seconds);
}
