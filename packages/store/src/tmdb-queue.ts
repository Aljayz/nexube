const MAX_CONCURRENT = 4;
let inflight = 0;
const waiters: Array<() => void> = [];

export async function acquireSlot(): Promise<void> {
  if (inflight < MAX_CONCURRENT) {
    inflight++;
    return;
  }
  return new Promise((resolve) => waiters.push(resolve));
}

export function releaseSlot(): void {
  inflight--;
  if (waiters.length > 0) {
    const next = waiters.shift()!;
    next();
  }
}

export function getQueueStatus(): { inflight: number; waiting: number } {
  return {
    inflight,
    waiting: waiters.length,
  };
}
