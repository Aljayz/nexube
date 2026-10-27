export interface PlayerState {
  isPlaying: boolean;
  progressSeconds: number;
  duration: number;
  bufferStatus: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  quality: string;
}

export interface SourcePlaybackOptions {
  /** Start playback at this position, in seconds. */
  startAt?: number;
  /** Player accent color, as a hex value with or without the leading `#`. */
  primaryColor?: string;
  /** Color of the progress bar behind the sliders. */
  secondaryColor?: string;
  /** Player icon color, as a hex value with or without the leading `#`. */
  iconColor?: string;
  /** Player icon style. */
  icons?: 'vid' | 'default';
  /** Whether the player shows the media title. */
  title?: boolean;
  /** Whether the player shows the poster image. */
  poster?: boolean;
  /** Whether playback starts automatically. */
  autoplay?: boolean;
  /** Whether the next-episode button is shown near the end of an episode. */
  nextbutton?: boolean;
  /** Player implementation to use. */
  player?: 'default' | 'jw';
  /** Direct URL to an external WebVTT subtitle file. */
  subFile?: string;
  /** Label for the external subtitle track. */
  subLabel?: string;
  /** URL to redirect to when the stream fails to load. */
  fallbackUrl?: string;
}

export interface PlayerSource {
  id: string;
  label: string;
  tag?: string;
  async?: boolean;
  supportsProgress: boolean;
  progressMethod: 'executeJavaScript' | 'frameIteration' | 'localServer';
  url: (
    type: 'movie' | 'tv',
    id: string | number,
    season?: number,
    episode?: number,
    options?: SourcePlaybackOptions
  ) => string | Promise<string>;
}

export interface SourceSelection {
  default: PlayerSource;
  fallbacks: PlayerSource[];
  isAnime: boolean;
}

export interface WatchProgress {
  mediaId: string;
  tmdbId: number;
  type: 'movie' | 'tv';
  progressPercent: number;
  progressSeconds: number;
  duration: number;
  lastWatched: string;
  season?: number;
  episode?: number;
}

export interface WatchHistory {
  mediaId: string;
  tmdbId: number;
  type: 'movie' | 'tv';
  title: string;
  posterPath: string | null;
  completedAt: string;
  season?: number;
  episode?: number;
}

export interface SkipSegment {
  interval: {
    startTime: number;
    endTime: number;
  };
  skipType: 'intro' | 'outro';
}

export interface InactivityState {
  isVisible: boolean;
  lastActivity: number;
  timeoutMs: number;
}

export interface Download {
  id: string;
  profileId: string;
  mediaId: string;
  filePath?: string | null;
  quality?: string | null;
  size: number;
  status: 'downloading' | 'completed' | 'failed' | 'paused' | 'cancelled';
  progressPercent: number;
  progressBytes: number;
  totalBytes?: number | null;
  speed?: string | null;
  error?: string | null;
  m3u8Url?: string | null;
  referer?: string | null;
  cookies?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  addedAt: string;
  season?: number | null;
  episode?: number | null;
  sourceId?: string | null;
  title?: string;
  type?: 'movie' | 'tv';
  posterPath?: string | null;
  tmdbId?: number;
}
