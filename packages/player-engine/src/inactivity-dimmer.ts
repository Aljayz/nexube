import type { InactivityState } from '@nexube/types';

const DEFAULT_TIMEOUT = 3000;

export class InactivityDimmer {
  private state: InactivityState = {
    isVisible: true,
    lastActivity: Date.now(),
    timeoutMs: DEFAULT_TIMEOUT,
  };
  private timer: ReturnType<typeof setTimeout> | null = null;
  private onVisibilityChange: ((visible: boolean) => void) | null = null;

  constructor(timeoutMs: number = DEFAULT_TIMEOUT) {
    this.state.timeoutMs = timeoutMs;
  }

  setOnVisibilityChange(callback: (visible: boolean) => void): void {
    this.onVisibilityChange = callback;
  }

  recordActivity(): void {
    this.state.lastActivity = Date.now();
    this.state.isVisible = true;

    if (this.onVisibilityChange) {
      this.onVisibilityChange(true);
    }

    this.startTimer();
  }

  private startTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      this.state.isVisible = false;
      if (this.onVisibilityChange) {
        this.onVisibilityChange(false);
      }
    }, this.state.timeoutMs);
  }

  getState(): InactivityState {
    return { ...this.state };
  }

  show(): void {
    this.state.isVisible = true;
    if (this.onVisibilityChange) {
      this.onVisibilityChange(true);
    }
    this.startTimer();
  }

  hide(): void {
    this.state.isVisible = false;
    if (this.onVisibilityChange) {
      this.onVisibilityChange(false);
    }
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  destroy(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
