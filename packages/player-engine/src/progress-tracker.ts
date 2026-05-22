import type { PlayerState } from '@nexube/types';

export interface ProgressTrackerConfig {
  intervalMs: number;
  autoMarkThreshold: number;
  onProgress?: (progress: { seconds: number; percent: number }) => void;
  onCompleted?: () => void;
}

const DEFAULT_CONFIG: ProgressTrackerConfig = {
  intervalMs: 5000,
  autoMarkThreshold: 20,
};

export class ProgressTracker {
  private config: ProgressTrackerConfig;
  private timer: ReturnType<typeof setInterval> | null = null;
  private autoMarked = false;
  private lastKnownTime = 0;
  private seekBackCooldown = 0;

  constructor(config: Partial<ProgressTrackerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  start(getState: () => PlayerState): void {
    this.stop();
    this.autoMarked = false;

    this.timer = setInterval(() => {
      const state = getState();
      if (!state.isPlaying || state.duration === 0) return;

      this.lastKnownTime = state.progressSeconds;
      const percent = (state.progressSeconds / state.duration) * 100;

      if (this.config.onProgress) {
        this.config.onProgress({ seconds: state.progressSeconds, percent });
      }

      if (
        !this.autoMarked &&
        state.duration - state.progressSeconds <= this.config.autoMarkThreshold
      ) {
        this.autoMarked = true;
        if (this.config.onCompleted) {
          this.config.onCompleted();
        }
      }
    }, this.config.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  checkResolutionReset(
    currentTime: number,
    recentUserSeek: boolean,
    seekBack: (time: number) => void
  ): void {
    const now = Date.now();
    if (now < this.seekBackCooldown) return;

    if (this.lastKnownTime > 30 && currentTime <= 5 && !recentUserSeek) {
      this.seekBackCooldown = now + 8000;
      seekBack(this.lastKnownTime);
    }
  }

  reset(): void {
    this.stop();
    this.autoMarked = false;
    this.lastKnownTime = 0;
    this.seekBackCooldown = 0;
  }
}
