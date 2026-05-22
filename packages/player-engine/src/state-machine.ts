import type { PlayerState } from '@nexube/types';

const DEFAULT_STATE: PlayerState = {
  isPlaying: false,
  progressSeconds: 0,
  duration: 0,
  bufferStatus: 0,
  volume: 1,
  isMuted: false,
  playbackRate: 1,
  quality: 'auto',
};

type StateListener = (state: PlayerState) => void;

export class PlayerStateMachine {
  private state: PlayerState = { ...DEFAULT_STATE };
  private listeners: StateListener[] = [];

  getState(): PlayerState {
    return { ...this.state };
  }

  setState(updates: Partial<PlayerState>): void {
    this.state = { ...this.state, ...updates };
    this.notifyListeners();
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  play(): void {
    this.setState({ isPlaying: true });
  }

  pause(): void {
    this.setState({ isPlaying: false });
  }

  togglePlay(): void {
    this.setState({ isPlaying: !this.state.isPlaying });
  }

  seek(seconds: number): void {
    this.setState({ progressSeconds: Math.max(0, Math.min(seconds, this.state.duration)) });
  }

  setProgress(seconds: number, duration: number): void {
    this.setState({
      progressSeconds: seconds,
      duration: duration || this.state.duration,
    });
  }

  setVolume(volume: number): void {
    this.setState({ volume: Math.max(0, Math.min(1, volume)), isMuted: volume === 0 });
  }

  toggleMute(): void {
    this.setState({ isMuted: !this.state.isMuted });
  }

  setPlaybackRate(rate: number): void {
    this.setState({ playbackRate: rate });
  }

  setQuality(quality: string): void {
    this.setState({ quality });
  }

  setBufferStatus(status: number): void {
    this.setState({ bufferStatus: status });
  }

  getProgressPercent(): number {
    if (this.state.duration === 0) return 0;
    return (this.state.progressSeconds / this.state.duration) * 100;
  }

  reset(): void {
    this.state = { ...DEFAULT_STATE };
    this.notifyListeners();
  }
}

export const playerMachine = new PlayerStateMachine();
