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
function vidsrcUrl(type, id, season, episode) {
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

/**
 * Build a VidAPI embed URL.
 *
 * TV embeds require both season and episode, so missing values fall back to
 * season 1 / episode 1. IDs may be TMDB numeric IDs or IMDb IDs with the `tt`
 * prefix. Query options (resumeAt, subtitles, autoplay, etc.) are documented at
 * https://vaplayer.ru.
 */
function vidapiUrl(type, id, season, episode, options) {
  const url =
    type === 'movie'
      ? `https://vaplayer.ru/embed/movie/${id}`
      : `https://vaplayer.ru/embed/tv/${id}/${season ?? 1}/${episode ?? 1}`;

  if (options?.startAt && options.startAt > 0) {
    return `${url}?resumeAt=${Math.floor(options.startAt)}`;
  }

  return url;
}

const PLAYER_SOURCES = [
  {
    id: 'videasy',
    label: 'Videasy',
    url: (type, id, season, episode) => {
      if (type === 'movie') return `https://player.videasy.net/movie/${id}`;
      return `https://player.videasy.net/tv/${id}/${season}/${episode}`;
    },
  },
  {
    id: 'vidapi',
    label: 'VidAPI',
    url: (type, id, season, episode, options) =>
      vidapiUrl(type, id, season, episode, options),
  },
  {
    id: 'vidsrc',
    label: 'VidSrc',
    url: (type, id, season, episode) => vidsrcUrl(type, id, season, episode),
  },
  {
    id: 'allmanga',
    label: 'AllManga',
    tag: 'ANIME',
    url: (type, id, season, episode) => {
      return `https://allmanga.to/video?id=${id}&ep=${episode || 1}`;
    },
  },
];

function getSourceById(id) {
  return PLAYER_SOURCES.find((s) => s.id === id);
}

module.exports = { PLAYER_SOURCES, getSourceById };
