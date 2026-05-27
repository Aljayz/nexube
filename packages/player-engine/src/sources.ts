import type { PlayerSource } from '@nexube/types';

export const PLAYER_SOURCES: PlayerSource[] = [
  {
    id: 'videasy',
    label: 'Videasy',
    supportsProgress: true,
    progressMethod: 'executeJavaScript',
    url: (type, id, season?, episode?) => {
      if (type === 'movie') {
        return `https://player.videasy.net/movie/${id}`;
      }
      return `https://player.videasy.net/tv/${id}/${season}/${episode}`;
    },
  },
  {
    id: 'vidapi',
    label: 'VidAPI',
    supportsProgress: true,
    progressMethod: 'frameIteration',
    url: (type, id, season?, episode?) => {
      if (type === 'movie') {
        return `https://vaplayer.ru/embed/movie/${id}`;
      }
      return `https://vaplayer.ru/embed/tv/${id}/${season}/${episode}`;
    },
  },
  {
    id: 'vidsrc',
    label: 'VidSrc',
    supportsProgress: true,
    progressMethod: 'frameIteration',
    url: (type, id, season?, episode?) => {
      if (type === 'movie') {
        return `https://vidsrc.to/embed/movie/${id}`;
      }
      return `https://vidsrc.to/embed/tv/${id}/${season}/${episode}`;
    },
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
