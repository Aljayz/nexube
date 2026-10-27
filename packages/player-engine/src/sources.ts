import type { PlayerSource, SourcePlaybackOptions } from '@nexube/types';

/**
 * Build a VidSrc embed URL.
 *
 * Supported forms (https://vidsrc.to):
 *   /embed/movie/{id}
 *   /embed/tv/{id}/{season}
 *   /embed/tv/{id}/{season}/{episode}
 *
 * IDs may be TMDB numeric IDs or IMDb IDs with the `tt` prefix.
 */
function vidsrcUrl(
  type: 'movie' | 'tv',
  id: string | number,
  season?: number,
  episode?: number,
): string {
  if (type === 'movie') {
    return `https://vidsrc.to/embed/movie/${id}`;
  }

  const base = `https://vidsrc.to/embed/tv/${id}`;
  const seasonNumber = season ?? 1;

  if (episode == null) {
    return `${base}/${seasonNumber}`;
  }

  return `${base}/${seasonNumber}/${episode}`;
}

const VIDLINK_BASE = 'https://vidlink.pro';

function normalizeHexColor(color: string): string {
  return color.replace(/^#/, '');
}

/**
 * Build a VidLink embed URL.
 *
 * Supported forms (https://vidlink.pro):
 *   /movie/{tmdbId}
 *   /tv/{tmdbId}/{season}/{episode}
 *
 * TV embeds require both season and episode, so missing values fall back to
 * season 1 / episode 1. The documented customization parameters are appended
 * only when the caller supplies them.
 */
function vidlinkUrl(
  type: 'movie' | 'tv',
  id: string | number,
  season?: number,
  episode?: number,
  options?: SourcePlaybackOptions,
): string {
  const url =
    type === 'movie'
      ? `${VIDLINK_BASE}/movie/${id}`
      : `${VIDLINK_BASE}/tv/${id}/${season ?? 1}/${episode ?? 1}`;

  const params = new URLSearchParams();

  if (options?.startAt && options.startAt > 0) {
    params.set('startAt', String(Math.floor(options.startAt)));
  }
  if (options?.primaryColor) {
    params.set('primaryColor', normalizeHexColor(options.primaryColor));
  }
  if (options?.secondaryColor) {
    params.set('secondaryColor', normalizeHexColor(options.secondaryColor));
  }
  if (options?.iconColor) {
    params.set('iconColor', normalizeHexColor(options.iconColor));
  }
  if (options?.icons) params.set('icons', options.icons);
  if (options?.title !== undefined) params.set('title', String(options.title));
  if (options?.poster !== undefined) params.set('poster', String(options.poster));
  if (options?.autoplay !== undefined) params.set('autoplay', String(options.autoplay));
  if (options?.nextbutton !== undefined) params.set('nextbutton', String(options.nextbutton));
  // Use VidLink's bundled JW Player + Shaka path by default. Its default
  // Vidstack player loads its DASH provider from a separate chunk that can
  // fail to load, leaving playback stuck at 0:00.
  params.set('player', options?.player ?? 'jw');
  if (options?.subFile) params.set('sub_file', options.subFile);
  if (options?.subLabel) params.set('sub_label', options.subLabel);
  if (options?.fallbackUrl) params.set('fallback_url', options.fallbackUrl);

  const query = params.toString();
  return query ? `${url}?${query}` : url;
}

/**
 * Build an EmbedWave embed URL.
 *
 * Supported forms (https://embedwave.cc/docs):
 *   /embed/movie/{tmdb_id}
 *   /embed/tv/{tmdb_id}/{season}/{episode} (season/episode required, 1-indexed)
 *
 * The docs list optional `server` (nxsha | cinesrc | videasy, default nxsha)
 * and `autoplay` params, but no resume/progress parameter.
 */
function embedwaveUrl(
  type: 'movie' | 'tv',
  id: string | number,
  season?: number,
  episode?: number,
): string {
  if (type === 'movie') {
    return `https://embedwave.cc/embed/movie/${id}`;
  }
  return `https://embedwave.cc/embed/tv/${id}/${season ?? 1}/${episode ?? 1}`;
}

export const PLAYER_SOURCES: PlayerSource[] = [
  {
    id: 'vidlink',
    label: 'VidLink',
    supportsProgress: true,
    progressMethod: 'executeJavaScript',
    url: (type, id, season?, episode?, options?) =>
      vidlinkUrl(type, id, season, episode, options),
  },
  {
    id: 'embedwave',
    label: 'EmbedWave',
    supportsProgress: true,
    progressMethod: 'frameIteration',
    url: (type, id, season?, episode?) => embedwaveUrl(type, id, season, episode),
  },
  {
    id: 'vidsrc',
    label: 'VidSrc',
    supportsProgress: true,
    progressMethod: 'frameIteration',
    url: (type, id, season?, episode?) => vidsrcUrl(type, id, season, episode),
  },
  {
    id: 'allmanga',
    label: 'AllManga',
    tag: 'ANIME',
    async: true,
    supportsProgress: true,
    progressMethod: 'localServer',
    url: async (type, id, season?, episode?) => {
      return `https://allmanga.to/video?id=${id}&ep=${episode || 1}`;
    },
  },
];

export function getSourceById(id: string): PlayerSource | undefined {
  return PLAYER_SOURCES.find((s) => s.id === id);
}

export function getStandardSources(): PlayerSource[] {
  return PLAYER_SOURCES.filter((s) => !s.tag);
}

export function getAnimeSources(): PlayerSource[] {
  return PLAYER_SOURCES.filter((s) => s.tag === 'ANIME');
}
