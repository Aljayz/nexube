export interface TmdbImageConfig {
  base_url: string;
  secure_base_url: string;
  backdrop_sizes: string[];
  logo_sizes: string[];
  poster_sizes: string[];
  profile_sizes: string[];
  still_sizes: string[];
}

export interface TmdbConfiguration {
  images: TmdbImageConfig;
  change_keys: string[];
}

export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbProductionCompany {
  id: number;
  logo_path: string | null;
  name: string;
  origin_country: string;
}

export interface TmdbProductionCountry {
  iso_3166_1: string;
  name: string;
}

export interface TmdbSpokenLanguage {
  english_name: string;
  iso_639_1: string;
  name: string;
}

export interface TmdbCollection {
  id: number;
  name: string;
  poster_path: string | null;
  backdrop_path: string | null;
}

export interface TmdbMovie {
  adult: boolean;
  backdrop_path: string | null;
  belongs_to_collection: TmdbCollection | null;
  budget: number;
  genres: TmdbGenre[];
  homepage: string;
  id: number;
  imdb_id: string;
  origin_country: string[];
  original_language: string;
  original_title: string;
  overview: string;
  popularity: number;
  poster_path: string | null;
  production_companies: TmdbProductionCompany[];
  production_countries: TmdbProductionCountry[];
  release_date: string;
  revenue: number;
  runtime: number;
  spoken_languages: TmdbSpokenLanguage[];
  status: string;
  tagline: string;
  title: string;
  video: boolean;
  vote_average: number;
  vote_count: number;
}

export interface TmdbMovieListItem {
  adult: boolean;
  backdrop_path: string | null;
  genre_ids: number[];
  id: number;
  original_language: string;
  original_title: string;
  overview: string;
  popularity: number;
  poster_path: string | null;
  release_date: string;
  title: string;
  video: boolean;
  vote_average: number;
  vote_count: number;
}

export interface TmdbTvShow {
  adult: boolean;
  backdrop_path: string | null;
  created_by: TmdbCreator[];
  episode_run_time: number[];
  first_air_date: string;
  genres: TmdbGenre[];
  homepage: string;
  id: number;
  in_production: boolean;
  languages: string[];
  last_air_date: string;
  last_episode_to_air: TmdbEpisode | null;
  name: string;
  next_episode_to_air: TmdbEpisode | null;
  networks: TmdbNetwork[];
  number_of_episodes: number;
  number_of_seasons: number;
  origin_country: string[];
  original_language: string;
  original_name: string;
  overview: string;
  popularity: number;
  poster_path: string | null;
  production_companies: TmdbProductionCompany[];
  production_countries: TmdbProductionCountry[];
  seasons: TmdbSeason[];
  spoken_languages: TmdbSpokenLanguage[];
  status: string;
  tagline: string;
  type: string;
  vote_average: number;
  vote_count: number;
}

export interface TmdbTvListItem {
  backdrop_path: string | null;
  first_air_date: string;
  genre_ids: number[];
  id: number;
  name: string;
  origin_country: string[];
  original_language: string;
  original_name: string;
  overview: string;
  popularity: number;
  poster_path: string | null;
  vote_average: number;
  vote_count: number;
}

export interface TmdbCreator {
  id: number;
  credit_id: string;
  name: string;
  gender: number;
  profile_path: string | null;
}

export interface TmdbNetwork {
  id: number;
  logo_path: string | null;
  name: string;
  origin_country: string;
}

export interface TmdbSeason {
  air_date: string;
  episode_count: number;
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  season_number: number;
  vote_average: number;
}

export interface TmdbEpisode {
  air_date: string;
  episode_number: number;
  episode_type: string;
  id: number;
  name: string;
  overview: string;
  production_code: string;
  runtime: number;
  season_number: number;
  show_id: number;
  still_path: string | null;
  vote_average: number;
  vote_count: number;
  crew: TmdbCrewMember[];
  guest_stars: TmdbGuestStar[];
}

export interface TmdbCrewMember {
  department: string;
  job: string;
  credit_id: string;
  adult: boolean;
  gender: number;
  id: number;
  known_for_department: string;
  name: string;
  original_name: string;
  popularity: number;
  profile_path: string | null;
}

export interface TmdbGuestStar {
  character: string;
  credit_id: string;
  order: number;
  adult: boolean;
  gender: number;
  id: number;
  known_for_department: string;
  name: string;
  original_name: string;
  popularity: number;
  profile_path: string | null;
}

export interface TmdbSeasonDetails {
  _id: string;
  air_date: string;
  episodes: TmdbEpisode[];
  name: string;
  overview: string;
  id: number;
  poster_path: string | null;
  season_number: number;
  vote_average: number;
}

export interface TmdbVideo {
  iso_639_1: string;
  iso_3166_1: string;
  name: string;
  key: string;
  site: string;
  size: number;
  type: string;
  official: boolean;
  published_at: string;
  id: string;
}

export interface TmdbVideoResults {
  id: number;
  results: TmdbVideo[];
}

export interface TmdbImageItem {
  aspect_ratio: number;
  height: number;
  iso_639_1: string | null;
  file_path: string;
  vote_average: number;
  vote_count: number;
  width: number;
}

export interface TmdbImageResults {
  id: number;
  backdrops: TmdbImageItem[];
  logos: TmdbImageItem[];
  posters: TmdbImageItem[];
}

export interface TmdbCertification {
  certification: string;
  meaning: string;
  order: number;
}

export interface TmdbCertificationResults {
  certifications: Record<string, TmdbCertification[]>;
}

export interface TmdbContentRating {
  descriptors: string[];
  iso_3166_1: string;
  rating: string;
}

export interface TmdbContentRatingResults {
  results: TmdbContentRating[];
  id: number;
}

export interface TmdbReleaseDate {
  certification: string;
  descriptors: string[];
  iso_639_1: string;
  note: string;
  release_date: string;
  type: number;
}

export interface TmdbReleaseDateResult {
  iso_3166_1: string;
  release_dates: TmdbReleaseDate[];
}

export interface TmdbReleaseDateResults {
  id: number;
  results: TmdbReleaseDateResult[];
}

export interface TmdbTrendingResults<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

export interface TmdbSearchResults<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

export interface TmdbMultiSearchResult {
  adult: boolean;
  backdrop_path: string | null;
  id: number;
  title?: string;
  name?: string;
  original_language: string;
  original_title?: string;
  original_name?: string;
  overview: string;
  poster_path: string | null;
  media_type: 'movie' | 'tv' | 'person';
  genre_ids: number[];
  popularity: number;
  release_date?: string;
  first_air_date?: string;
  video?: boolean;
  vote_average: number;
  vote_count: number;
  origin_country?: string[];
}

export interface TmdbDates {
  maximum: string;
  minimum: string;
}

export interface TmdbNowPlayingResults {
  dates: TmdbDates;
  page: number;
  results: TmdbMovieListItem[];
  total_pages: number;
  total_results: number;
}

export interface TmdbUpcomingResults {
  dates: TmdbDates;
  page: number;
  results: TmdbMovieListItem[];
  total_pages: number;
  total_results: number;
}

export interface TmdbErrorResponse {
  status_code: number;
  status_message: string;
  success: boolean;
}
