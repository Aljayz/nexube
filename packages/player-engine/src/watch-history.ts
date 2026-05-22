import type { WatchProgress, WatchHistory } from '@nexube/types';

export class WatchHistoryTracker {
  private progressMap: Map<string, WatchProgress> = new Map();
  private history: WatchHistory[] = [];

  updateProgress(progress: WatchProgress): void {
    this.progressMap.set(progress.mediaId, progress);
  }

  getProgress(mediaId: string): WatchProgress | undefined {
    return this.progressMap.get(mediaId);
  }

  getAllProgress(): WatchProgress[] {
    return Array.from(this.progressMap.values());
  }

  getContinueWatching(threshold: number = 95): WatchProgress[] {
    return Array.from(this.progressMap.values())
      .filter((p) => p.progressPercent > 0 && p.progressPercent < threshold)
      .sort((a, b) => new Date(b.lastWatched).getTime() - new Date(a.lastWatched).getTime());
  }

  addCompleted(history: WatchHistory): void {
    this.history.unshift(history);
    this.progressMap.delete(history.mediaId);
  }

  getHistory(): WatchHistory[] {
    return this.history;
  }

  clearProgress(mediaId: string): void {
    this.progressMap.delete(mediaId);
  }

  clearAll(): void {
    this.progressMap.clear();
    this.history = [];
  }
}

export const watchTracker = new WatchHistoryTracker();
