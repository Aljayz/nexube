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
    id: 'vidsrc',
    label: 'VidSrc',
    url: (type, id, season, episode) => {
      if (type === 'movie') return `https://vidsrc.to/embed/movie/${id}`;
      return `https://vidsrc.to/embed/tv/${id}/${season}/${episode}`;
    },
  },
  {
    id: '2embed',
    label: '2Embed',
    url: (type, id, season, episode) => {
      if (type === 'movie') return `https://www.2embed.cc/embed/${id}`;
      return `https://www.2embed.cc/embedtv/${id}&s=${season}&e=${episode}`;
    },
  },
  {
    id: 'allmanga',
    label: 'AllManga',
    tag: 'ANIME',
    url: async (type, id, season, episode) => {
      return `https://allmanga.to/video?id=${id}&ep=${episode || 1}`;
    },
  },
];

function getSourceById(id) {
  return PLAYER_SOURCES.find((s) => s.id === id);
}

module.exports = { PLAYER_SOURCES, getSourceById };
