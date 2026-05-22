import type { SkipSegment } from '@nexube/types';

const ANISKIP_API_BASE = 'https://api.aniskip.com/v2';

export async function fetchSkipTimes(
  tmdbId: number,
  episodeNumber: number,
  types: ('intro' | 'outro')[] = ['intro', 'outro']
): Promise<SkipSegment[]> {
  try {
    const params = new URLSearchParams();
    params.append('types', types.join(','));

    const response = await fetch(
      `${ANISKIP_API_BASE}/skip-times/${tmdbId}/${episodeNumber}?${params}`
    );

    if (!response.ok) return [];

    const data = await response.json();
    return data.results || [];
  } catch {
    return [];
  }
}

export function getActiveSkipSegment(
  segments: SkipSegment[],
  currentTime: number
): SkipSegment | null {
  for (const segment of segments) {
    if (currentTime >= segment.interval.startTime && currentTime <= segment.interval.endTime) {
      return segment;
    }
  }
  return null;
}

export function getUpcomingSkipSegment(
  segments: SkipSegment[],
  currentTime: number,
  lookAheadSeconds: number = 5
): SkipSegment | null {
  for (const segment of segments) {
    if (
      segment.interval.startTime > currentTime &&
      segment.interval.startTime <= currentTime + lookAheadSeconds
    ) {
      return segment;
    }
  }
  return null;
}
