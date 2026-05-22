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
    episode?: number
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
