import type { PlayerSource, SourceSelection } from '@nexube/types';
import { PLAYER_SOURCES, getStandardSources, getAnimeSources } from './sources';

const ANIMATION_GENRE_ID = 16;

export function detectOptimalSource(media: {
  genres?: { id: number; name: string }[];
  originalLanguage?: string;
  isAnime?: boolean;
}): SourceSelection {
  const isAnime = checkIsAnime(media);

  if (isAnime) {
    const animeSource = PLAYER_SOURCES.find((s) => s.id === 'allmanga');
    const fallbacks = getStandardSources();

    return {
      default: animeSource || getStandardSources()[0],
      fallbacks,
      isAnime: true,
    };
  }

  const standardSources = getStandardSources();
  return {
    default: standardSources[0],
    fallbacks: standardSources.slice(1),
    isAnime: false,
  };
}

export function checkIsAnime(media: {
  genres?: { id: number; name: string }[];
  originalLanguage?: string;
  isAnime?: boolean;
}): boolean {
  if (media.isAnime !== undefined) return media.isAnime;

  const hasAnimationGenre = media.genres?.some(
    (g) => g.id === ANIMATION_GENRE_ID
  );
  const isJapanese = media.originalLanguage === 'ja';

  return hasAnimationGenre === true && isJapanese === true;
}

export function getSourceForMedia(
  media: {
    genres?: { id: number; name: string }[];
    originalLanguage?: string;
    isAnime?: boolean;
  },
  preferredSourceId?: string
): PlayerSource {
  if (preferredSourceId) {
    const source = PLAYER_SOURCES.find((s) => s.id === preferredSourceId);
    if (source) return source;
  }

  const selection = detectOptimalSource(media);
  return selection.default;
}
