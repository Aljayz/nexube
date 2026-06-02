const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const WYZIE_API = 'https://sub.wyzie.io';
const SUBDL_API = 'https://api.subdl.com/api/v1/subtitles';
const SUBDL_DL = 'https://dl.subdl.com';

const ZIP_MAX_OUTPUT_BYTES = 10 * 1024 * 1024;
const SUBTITLE_EXTS = new Set(['srt', 'vtt', 'ass', 'ssa']);

async function fetchUrl(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Nexube/1.0' },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

async function fetchBuffer(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Nexube/1.0' },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

function extractSubtitleFromZip(buf) {
  let offset = 0;
  while (offset < buf.length - 30) {
    if (buf[offset] === 0x50 && buf[offset + 1] === 0x4b && buf[offset + 2] === 0x03 && buf[offset + 3] === 0x04) {
      const compression = buf.readUInt16LE(offset + 8);
      const compressedSize = buf.readUInt32LE(offset + 18);
      const fileNameLen = buf.readUInt16LE(offset + 26);
      const extraLen = buf.readUInt16LE(offset + 28);
      const rawFileName = buf.slice(offset + 30, offset + 30 + fileNameLen).toString('utf8');
      const dataOffset = offset + 30 + fileNameLen + extraLen;
      const fileName = path.basename(rawFileName);
      const ext = fileName.toLowerCase().split('.').pop();
      if (SUBTITLE_EXTS.has(ext)) {
        const compressedData = buf.slice(dataOffset, dataOffset + compressedSize);
        let data;
        if (compression === 0) {
          if (compressedData.length > ZIP_MAX_OUTPUT_BYTES) { offset = dataOffset + compressedSize; continue; }
          data = compressedData;
        } else if (compression === 8) {
          try {
            data = zlib.inflateRawSync(compressedData, { maxOutputLength: ZIP_MAX_OUTPUT_BYTES });
          } catch { offset = dataOffset + compressedSize; continue; }
        } else { offset = dataOffset + compressedSize; continue; }
        return { data, name: fileName };
      }
      offset = dataOffset + compressedSize;
    } else { offset++; }
  }
  return null;
}

function srtToVtt(srt) {
  let vtt = 'WEBVTT\n\n';
  vtt += srt
    .replace(/\r\n/g, '\n')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
    .replace(/\n\n+/g, '\n\n')
    .trim();
  return vtt;
}

function getLanguageName(code) {
  const names = {
    en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian',
    pt: 'Portuguese', 'pt-BR': 'Brazilian Portuguese', ru: 'Russian', ja: 'Japanese',
    ko: 'Korean', zh: 'Chinese', ar: 'Arabic', hi: 'Hindi', nl: 'Dutch',
    pl: 'Polish', sv: 'Swedish', da: 'Danish', fi: 'Finnish', nb: 'Norwegian',
    tr: 'Turkish', cs: 'Czech', hu: 'Hungarian', ro: 'Romanian', vi: 'Vietnamese',
    th: 'Thai', id: 'Indonesian', ms: 'Malay', tl: 'Filipino', uk: 'Ukrainian',
    el: 'Greek', he: 'Hebrew',
  };
  return names[code] || code;
}

async function fetchSources(apiKey) {
  if (!apiKey) return { sources: [], available: [], tiered: [] };
  try {
    const body = await fetchUrl(`${WYZIE_API}/sources?key=${encodeURIComponent(apiKey)}`);
    return JSON.parse(body);
  } catch (e) {
    console.warn('[subtitles] fetch sources failed:', e.message);
    return { sources: [], available: [], tiered: [] };
  }
}

async function searchSubtitles({ tmdbId, imdbId, type, season, episode, languages, apiKey, sources }) {
  if (!apiKey) return [];

  const id = tmdbId || imdbId;
  if (!id) return [];

  const params = new URLSearchParams();
  params.set('id', String(id));
  params.set('key', apiKey);
  params.set('format', 'srt');
  if (languages && languages.length > 0) {
    params.set('language', languages.join(','));
  }
  if (sources && sources !== 'all') {
    params.set('source', sources);
  }
  if (type === 'tv' && season != null && episode != null) {
    params.set('season', String(season));
    params.set('episode', String(episode));
  }

  const url = `${WYZIE_API}/search?${params.toString()}`;
  try {
    const body = await fetchUrl(url);
    const data = JSON.parse(body);
    if (!Array.isArray(data)) return [];
    return data.filter((s) => s.url && s.format === 'srt');
  } catch (e) {
    console.warn('[subtitles] search failed:', e.message);
    return [];
  }
}

async function downloadAndSaveSubtitles(subtitles, targetDir, hashPrefix) {
  if (!subtitles || subtitles.length === 0) return [];

  try { fs.mkdirSync(targetDir, { recursive: true }); } catch {}

  // Deduplicate by language — keep first source per language
  const seen = new Set();
  const unique = subtitles.filter(s => {
    const lang = s.language || 'en';
    if (seen.has(lang)) return false;
    seen.add(lang);
    return true;
  });

  const results = [];

  for (const sub of unique) {
    try {
      const srtContent = await fetchUrl(sub.url);
      const vttContent = srtToVtt(srtContent);
      const langCode = sub.language || 'en';
      const fileName = hashPrefix ? `${hashPrefix}.${langCode}.vtt` : `${langCode}.vtt`;
      const filePath = path.join(targetDir, fileName);
      const srtFileName = fileName.replace('.vtt', '.srt');
      const srtFilePath = path.join(targetDir, srtFileName);
      fs.writeFileSync(srtFilePath, srtContent, 'utf-8');
      fs.writeFileSync(filePath, vttContent, 'utf-8');
      results.push({
        lang: langCode,
        label: getLanguageName(langCode),
        file: fileName,
        filePath,
      });
    } catch (e) {
      console.warn(`[subtitles] failed to save ${sub.language || 'unknown'}:`, e.message);
    }
  }

  return results;
}

async function searchSubDL({ tmdbId, type, season, episode, languages, apiKey }) {
  if (!apiKey) return [];

  const params = new URLSearchParams();
  params.set('api_key', apiKey);
  params.set('subs_per_page', '30');
  params.set('unpack', '1');
  if (tmdbId) params.set('tmdb_id', String(tmdbId));
  if (type === 'tv') {
    params.set('type', 'tv');
    if (season != null) params.set('season_number', String(season));
    if (episode != null) params.set('episode_number', String(episode));
  } else {
    params.set('type', 'movie');
  }

  const url = `${SUBDL_API}?${params.toString()}`;
  try {
    const body = await fetchUrl(url);
    const data = JSON.parse(body);
    if (!data.status || !Array.isArray(data.subtitles)) return [];

    const results = [];
    for (const sub of data.subtitles) {
      let lang = (sub.lang || sub.language || '').toLowerCase();
      if (languages && languages.length > 0 && !languages.includes(lang)) continue;

      if (Array.isArray(sub.unpack_files) && sub.unpack_files.length > 0) {
        for (const file of sub.unpack_files) {
          let fileLang = (file.language || lang || '').toLowerCase();
          if (languages && languages.length > 0 && !languages.includes(fileLang)) continue;
          const fmt = (file.format || 'srt').toLowerCase();
          results.push({
            url: `${SUBDL_DL}${file.url}`,
            language: fileLang,
            format: fmt,
            source: 'subdl',
          });
        }
      } else {
        results.push({
          url: `${SUBDL_DL}${sub.url}`,
          language: lang,
          format: 'srt',
          source: 'subdl',
        });
      }
    }
    return results;
  } catch (e) {
    console.warn('[subtitles] SubDL search failed:', e.message);
    return [];
  }
}

async function downloadAndSaveSubDLSubtitles(subtitles, targetDir, hashPrefix) {
  if (!subtitles || subtitles.length === 0) return [];

  try { fs.mkdirSync(targetDir, { recursive: true }); } catch {}

  const results = [];

  for (const sub of subtitles) {
    try {
      const buf = await fetchBuffer(sub.url);
      let content;
      if (sub.url.endsWith('.zip')) {
        const extracted = extractSubtitleFromZip(buf);
        if (!extracted) {
          console.warn(`[subtitles] no subtitle found in ZIP: ${sub.url}`);
          continue;
        }
        content = extracted.data.toString('utf-8');
      } else {
        content = buf.toString('utf-8');
      }

      const langCode = sub.language || 'en';
      let vttContent;
      if (sub.format === 'vtt' || content.startsWith('WEBVTT')) {
        vttContent = content.replace(/\r\n/g, '\n').replace(/\n\n+/g, '\n\n').trim();
      } else {
        vttContent = srtToVtt(content);
      }

      const fileName = hashPrefix ? `${hashPrefix}.${langCode}.vtt` : `${langCode}.vtt`;
      const filePath = path.join(targetDir, fileName);
      const rawFileName = hashPrefix ? `${hashPrefix}.${langCode}.${sub.format || 'srt'}` : `${langCode}.${sub.format || 'srt'}`;
      const rawFilePath = path.join(targetDir, rawFileName);
      fs.writeFileSync(rawFilePath, content, 'utf-8');
      fs.writeFileSync(filePath, vttContent, 'utf-8');
      results.push({
        lang: langCode,
        label: getLanguageName(langCode),
        file: fileName,
        filePath,
      });
    } catch (e) {
      console.warn(`[subtitles] SubDL failed to save ${sub.language || 'unknown'}:`, e.message);
    }
  }

  return results;
}

module.exports = { searchSubtitles, downloadAndSaveSubtitles, srtToVtt, fetchSources, searchSubDL, downloadAndSaveSubDLSubtitles };
