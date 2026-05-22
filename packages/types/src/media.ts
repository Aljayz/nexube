import type {
  TmdbMovie,
  TmdbTvShow,
  TmdbMovieListItem,
  TmdbTvListItem,
  TmdbGenre,
  TmdbVideo,
  TmdbImageItem,
  TmdbSeason,
  TmdbEpisode,
  TmdbCertification,
} from './tmdb';

export type MediaType = 'movie' | 'tv';

export interface MediaItem {
  id: string;
  tmdbId: number;
  title: string;
  type: MediaType;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string;
  releaseDate: string;
  voteAverage: number;
  voteCount: number;
  popularity: number;
  originalLanguage: string;
  genres: TmdbGenre[];
  runtime?: number;
  numberOfSeasons?: number;
  numberOfEpisodes?: number;
  status?: string;
  tagline?: string;
  trailerKey?: string;
  certification?: string;
  isAnime: boolean;
}

export interface MediaListItem {
  id: string;
  tmdbId: number;
  title: string;
  type: MediaType;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string;
  releaseDate: string;
  voteAverage: number;
  voteCount: number;
  popularity: number;
  originalLanguage: string;
  genreIds: number[];
  isAnime: boolean;
}

export interface MediaDetails extends MediaItem {
  videos: TmdbVideo[];
  images: {
    backdrops: TmdbImageItem[];
    posters: TmdbImageItem[];
  };
  seasons?: TmdbSeason[];
  certification?: string;
  certifications: Record<string, string>;
}

export interface TvDetails extends MediaDetails {
  seasons: TmdbSeason[];
  episodeRunTime: number[];
  createdBy: string[];
  networks: string[];
  inProduction: boolean;
}

export interface SeasonDetails {
  id: number;
  name: string;
  seasonNumber: number;
  airDate: string;
  overview: string;
  posterPath: string | null;
  episodes: EpisodeItem[];
}

export interface EpisodeItem {
  id: number;
  name: string;
  episodeNumber: number;
  seasonNumber: number;
  airDate: string;
  overview: string;
  stillPath: string | null;
  runtime: number;
  voteAverage: number;
  voteCount: number;
}

export interface CarouselRow {
  id: string;
  title: string;
  items: MediaListItem[];
  type: MediaType;
}

export function isAnimeMedia(media: {
  genres?: TmdbGenre[];
  originalLanguage?: string;
}): boolean {
  const ANIMATION_GENRE_ID = 16;
  const hasAnimationGenre = media.genres?.some(
    (g) => g.id === ANIMATION_GENRE_ID
  );
  const isJapanese = media.originalLanguage === 'ja';
  return hasAnimationGenre === true && isJapanese === true;
}
