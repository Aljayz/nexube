const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const WYZIE_API = 'https://sub.wyzie.io';

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'Nexube/1.0' } }, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    }).on('error', reject);
  });
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

async function searchSubtitles({ tmdbId, imdbId, type, season, episode, languages, apiKey }) {
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

  const results = [];

  for (const sub of subtitles) {
    try {
      const srtContent = await fetchUrl(sub.url);
      const vttContent = srtToVtt(srtContent);
      const langCode = sub.language || 'en';
      const fileName = hashPrefix ? `${hashPrefix}.${langCode}.vtt` : `${langCode}.vtt`;
      const filePath = path.join(targetDir, fileName);
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

module.exports = { searchSubtitles, downloadAndSaveSubtitles, srtToVtt };
