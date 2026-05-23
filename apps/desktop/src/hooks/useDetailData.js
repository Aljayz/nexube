import { useState, useEffect, useCallback } from 'react';
import { getSourceForMedia } from '@nexube/player-engine';

export function getMediaId(type, tmdbId) {
  return `${type}-${tmdbId}`;
}

export function buildMediaData(details) {
  if (!details) return null;
  return {
    id: `${details.type}-${details.tmdbId}`,
    tmdbId: details.tmdbId,
    title: details.title,
    type: details.type,
    posterPath: details.posterPath || null,
    backdropPath: details.backdropPath || null,
    overview: details.overview || '',
    releaseDate: details.releaseDate || '',
    voteAverage: details.voteAverage || 0,
    voteCount: details.voteCount || 0,
    popularity: details.popularity || 0,
    originalLanguage: details.originalLanguage || '',
    genres: JSON.stringify(details.genres || []),
    runtime: details.runtime || null,
    numberOfSeasons: details.numberOfSeasons || null,
    numberOfEpisodes: details.numberOfEpisodes || null,
    status: details.status || null,
    tagline: details.tagline || null,
    isAnime: details.isAnime || false,
  };
}

export function useDetailData(media, profileId, retryCount, preferredSource, isKids) {
  const mediaId = getMediaId(media.type, media.tmdbId);
  const [details, setDetails] = useState(null);
  const [videos, setVideos] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [episodes, setEpisodes] = useState([]);
  const [relatedMovies, setRelatedMovies] = useState([]);
  const [similarItems, setSimilarItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasCached, setHasCached] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savedProgress, setSavedProgress] = useState(null);

  useEffect(() => {
    async function fetchDetails(isRetry = false) {
      if (!isRetry) setError(null);

      try {
        const endpoint = media.type === 'movie' ? `/movie/${media.tmdbId}` : `/tv/${media.tmdbId}`;
        const appendKey = media.type === 'movie' ? 'images,release_dates' : 'images,content_ratings';

        const kidsParams = { kidsMode: isKids };
        const [detailsRes, videosRes] = await Promise.allSettled([
          window.electron?.tmdb?.fetch(endpoint, { ...kidsParams, append_to_response: appendKey }),
          window.electron?.tmdb?.fetch(`${endpoint}/videos`, kidsParams),
        ]);

        if (detailsRes.status === 'rejected') {
          throw new Error(detailsRes.reason?.message || 'Failed to load details');
        }

        if (detailsRes.value) {
          let certification = null;
          if (media.type === 'movie' && detailsRes.value.release_dates?.results) {
            const us = detailsRes.value.release_dates.results.find((r) => r.iso_3166_1 === 'US');
            if (us?.release_dates?.length > 0) {
              certification = us.release_dates[0].certification || null;
            }
          } else if (media.type === 'tv' && detailsRes.value.content_ratings?.results) {
            const us = detailsRes.value.content_ratings.results.find((r) => r.iso_3166_1 === 'US');
            certification = us?.rating || null;
          }

          const source = getSourceForMedia({
            genres: detailsRes.value.genres,
            originalLanguage: detailsRes.value.original_language,
          }, preferredSource);

          const enrichedDetails = {
            ...media,
            runtime: detailsRes.value.runtime,
            tagline: detailsRes.value.tagline,
            genres: detailsRes.value.genres,
            status: detailsRes.value.status,
            numberOfSeasons: detailsRes.value.number_of_seasons,
            numberOfEpisodes: detailsRes.value.number_of_episodes,
            isAnime: detailsRes.value.original_language === 'ja' && detailsRes.value.genres?.some((g) => g.id === 16),
            certification,
            selectedSource: source,
          };
          setDetails(enrichedDetails);

          const mediaData = buildMediaData(enrichedDetails);
          window.electron?.library?.media?.upsert(mediaData).catch(() => {});

          if (media.type === 'tv' && detailsRes.value.seasons) {
            const filteredSeasons = detailsRes.value.seasons.filter((s) => s.season_number > 0);
            setSeasons(filteredSeasons);
            if (filteredSeasons.length > 0) {
              setSelectedSeason(filteredSeasons[0].season_number);
            }
          }
        }

        if (videosRes.status === 'fulfilled' && videosRes.value?.results) {
          setVideos(videosRes.value.results.filter((v) => v.type === 'Trailer' && v.site === 'YouTube'));
        }

        setHasCached(true);
      } catch (err) {
        setError(err.message || 'Failed to load details');
      } finally {
        setLoading(false);
      }
    }

    fetchDetails(retryCount > 0);
  }, [media, retryCount]);

  useEffect(() => {
    let mounted = true;
    async function loadStatus() {
      try {
        const [favStatus, savedStatus, progress] = await Promise.all([
          window.electron?.library?.favorites?.isFavorite(profileId, mediaId),
          window.electron?.library?.saved?.isSaved(profileId, mediaId),
          window.electron?.library?.progress?.get(profileId, mediaId),
        ]);
        if (mounted) {
          setIsFavorite(!!favStatus);
          setIsSaved(!!savedStatus);
          setSavedProgress(progress || null);
        }
      } catch (err) {
        console.error('Failed to load status:', err);
      }
    }
    loadStatus();
    return () => { mounted = false; };
  }, [profileId, mediaId]);

  useEffect(() => {
    if (media.type === 'tv' && selectedSeason > 0) {
      window.electron?.tmdb?.fetch(`/tv/${media.tmdbId}/season/${selectedSeason}`, { kidsMode: isKids })
        .then((res) => res?.episodes && setEpisodes(res.episodes))
        .catch((err) => console.error('Failed to fetch episodes:', err));
    }
  }, [selectedSeason, media.type, media.tmdbId]);

  useEffect(() => {
    let mounted = true;
    const endpoint = media.type === 'movie' ? `/movie/${media.tmdbId}/similar` : `/tv/${media.tmdbId}/similar`;
    window.electron?.tmdb?.fetch(endpoint, { kidsMode: isKids })
      .then((res) => {
        if (!mounted || !res?.results) return;
        setSimilarItems(
          res.results.slice(0, 12).map((p) => ({
            id: `${media.type}-${p.id}`,
            tmdbId: p.id,
            title: p.title || p.name,
            type: media.type,
            mediaType: media.type === 'movie' ? 'Movie' : 'TV',
            posterPath: p.poster_path,
            backdropPath: p.backdrop_path,
            overview: p.overview,
            releaseDate: p.release_date || p.first_air_date,
            voteAverage: p.vote_average,
            voteCount: p.vote_count,
            popularity: p.popularity,
            originalLanguage: p.original_language,
            genreIds: p.genre_ids || [],
            certification: p.certification || null,
            isAnime: p.original_language === 'ja',
          }))
        );
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [media.type, media.tmdbId]);

  useEffect(() => {
    if (media.type !== 'movie') return;

    window.electron?.tmdb?.fetch(`/movie/${media.tmdbId}`, { kidsMode: isKids, append_to_response: 'belongs_to_collection' })
      .then((collectionsRes) => {
        if (!collectionsRes?.belongs_to_collection?.id) return;
        return window.electron?.tmdb?.fetch(`/collection/${collectionsRes.belongs_to_collection.id}`, { kidsMode: isKids });
      })
      .then((collectionRes) => {
        if (!collectionRes?.parts) return;
        setRelatedMovies(
          collectionRes.parts
            .filter((p) => p.id !== media.tmdbId)
            .map((p) => ({
              id: `movie-${p.id}`,
              tmdbId: p.id,
              title: p.title,
              type: 'movie',
              mediaType: 'Movie',
              posterPath: p.poster_path,
              backdropPath: p.backdrop_path,
              overview: p.overview,
              releaseDate: p.release_date,
              voteAverage: p.vote_average,
              voteCount: p.vote_count,
              popularity: p.popularity,
              originalLanguage: p.original_language,
              genreIds: p.genre_ids || [],
              certification: p.certification || null,
              isAnime: p.original_language === 'ja',
            }))
        );
      })
      .catch((err) => console.error('Failed to fetch related movies:', err));
  }, [media.type, media.tmdbId]);

  const updateSelectedSource = useCallback((source) => {
    setDetails((prev) => prev ? { ...prev, selectedSource: source } : prev);
  }, []);

  const toggleFavorite = useCallback(async () => {
    const mediaData = buildMediaData(details);
    if (isFavorite) {
      await window.electron?.library?.favorites?.remove(profileId, mediaId);
    } else {
      await window.electron?.library?.favorites?.add(profileId, mediaId, mediaData);
    }
    setIsFavorite(!isFavorite);
  }, [details, profileId, mediaId, isFavorite]);

  const toggleSaved = useCallback(async () => {
    const mediaData = buildMediaData(details);
    if (isSaved) {
      await window.electron?.library?.saved?.remove(profileId, mediaId);
    } else {
      await window.electron?.library?.saved?.add(profileId, mediaId, mediaData);
    }
    setIsSaved(!isSaved);
  }, [details, profileId, mediaId, isSaved]);

  return {
    details,
    videos,
    seasons,
    selectedSeason,
    setSelectedSeason,
    episodes,
    relatedMovies,
    similarItems,
    loading,
    error,
    hasCached,
    isFavorite,
    isSaved,
    savedProgress,
    setSavedProgress,
    toggleFavorite,
    toggleSaved,
    updateSelectedSource,
  };
}
