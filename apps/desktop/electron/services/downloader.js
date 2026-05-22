const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

const activeProcs = new Map();

function getBundledBinaryPath() {
  const platform = process.platform;
  const resourcePath = process.resourcesPath || path.resolve(__dirname, '../../resources');

  let binaryPath;
  if (platform === 'win32') {
    binaryPath = path.join(resourcePath, 'vid-dl.exe');
  } else {
    binaryPath = path.join(resourcePath, 'vid-dl');
  }

  const exists = fs.existsSync(binaryPath);
  console.log('[getBundledBinaryPath] resourcePath:', resourcePath, 'binaryPath:', binaryPath, 'exists:', exists);

  if (exists) return binaryPath;
  return null;
}

function checkDownloader(folderPath) {
  if (!folderPath) return { exists: false, reason: 'no_folder' };
  let entries;
  try {
    entries = fs.readdirSync(folderPath);
  } catch (e) {
    const reason = e.code === 'EACCES' ? 'folder_permission' : 'folder_unreadable';
    return { exists: false, reason };
  }
  if (!entries.includes('_internal')) {
    return { exists: false, reason: 'no_internal' };
  }
  const binary = entries.find((e) => {
    if (e === '_internal' || e.startsWith('.')) return false;
    try {
      const stat = fs.statSync(path.join(folderPath, e));
      if (!stat.isFile()) return false;
      return process.platform === 'win32'
        ? e.endsWith('.exe')
        : !!(stat.mode & 0o111);
    } catch {
      return false;
    }
  });
  if (!binary) return { exists: false, reason: 'no_executable' };
  return { exists: true, binaryPath: path.join(folderPath, binary) };
}

function runDownload({
  binaryPath,
  m3u8Url,
  name,
  downloadPath,
  mediaId,
  mediaType,
  season,
  episode,
  posterPath,
  tmdbId,
  subtitles,
  downloadId,
  initialProgress,
}, sendProgress, getDownloads, updateDownloadEntry, persistDownload) {
  try {
    const id = downloadId || crypto.randomUUID();

    if (activeProcs.has(id)) {
      return { ok: false, error: 'Download already in progress', id };
    }

    const logPath = path.join(os.tmpdir(), `nexube_dl_${id}.log`);

    const entry = {
      id,
      name,
      m3u8Url,
      downloadPath,
      filePath: null,
      status: 'downloading',
      progress: initialProgress || 0,
      speed: '',
      size: '',
      totalFragments: 0,
      completedFragments: 0,
      lastMessage: initialProgress ? `Resuming at ${initialProgress.toFixed(1)}%...` : 'Starting…',
      startedAt: Date.now(),
      completedAt: null,
      mediaId: mediaId || null,
      mediaType: mediaType || null,
      season: season || null,
      episode: episode || null,
      posterPath: posterPath || null,
      tmdbId: tmdbId || mediaId || null,
      subtitles: Array.isArray(subtitles) ? subtitles : [],
      subtitlePaths: [],
      logPath,
      _lastProgressTime: Date.now(),
    };

    try {
      fs.writeFileSync(
        logPath,
        `Nexube Download Log\nName: ${name}\nURL: ${m3u8Url}\nStarted: ${new Date().toISOString()}\n${'─'.repeat(60)}\n`,
        'utf8'
      );
    } catch {}

    updateDownloadEntry(id, entry);

    const persistProgress = () => {
      if (!persistDownload) return;
      try {
        persistDownload(id, {
          status: entry.status,
          progressPercent: entry.progress,
          speed: entry.speed || null,
          filePath: entry.filePath || null,
          size: typeof entry.size === 'string' ? 0 : entry.size || 0,
          startedAt: entry.startedAt ? new Date(entry.startedAt).toISOString() : null,
          completedAt: entry.completedAt ? new Date(entry.completedAt).toISOString() : null,
        });
      } catch {}
    };

    const args = [
      '--cli',
      m3u8Url,
      '-f',
      'mp4 (with Audio)',
      '-r',
      'best',
      '-b',
      '320',
      '-n',
      name,
      '-d',
      downloadPath,
    ];

    const proc = spawn(binaryPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });
    activeProcs.set(id, proc);
    if (persistDownload) {
      try {
        persistDownload(id, { processId: proc.pid });
      } catch {}
    }

    const STUCK_TIMEOUT_MS = 30000;
    const STUCK_CHECK_INTERVAL_MS = 5000;
    const stuckTimer = setInterval(() => {
      if (entry.status !== 'downloading') {
        clearInterval(stuckTimer);
        return;
      }
      const elapsed = Date.now() - entry._lastProgressTime;
      if (elapsed > STUCK_TIMEOUT_MS && Date.now() - entry.startedAt > STUCK_TIMEOUT_MS) {
        const msg = `Download stuck — no progress for ${Math.round(elapsed / 1000)}s`;
        entry.status = 'error';
        entry.completedAt = Date.now();
        entry.lastMessage = msg;
        stopDownload(id);
        sendProgress({ id, status: 'error', lastMessage: msg, progress: entry.progress });
        persistProgress();
        clearInterval(stuckTimer);
        try { fs.appendFileSync(logPath, `\n${msg}\nFinished: ${new Date().toISOString()}\n`); } catch {}
      }
    }, STUCK_CHECK_INTERVAL_MS);

    const handleLine = (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      const update = {};

      const fragMatch = trimmed.match(/\(frag\s+(\d+)\/(\d+)\)/);
      if (fragMatch) {
        const currentFrag = parseInt(fragMatch[1]);
        const total = parseInt(fragMatch[2]);
        update.completedFragments = currentFrag;
        update.totalFragments = total;
        update.progress = Math.min(99, (currentFrag / total) * 100);
        update.lastMessage = `Fragment ${currentFrag} / ${total}`;
        entry._lastProgressTime = Date.now();
      }

      if (!fragMatch) {
        const dlPctMatch = trimmed.match(
          /^\[download\]\s+([\d.]+)%\s+of\s+~?\s*([\d.]+\s*(?:[KMGT]i?B|B))/i
        );
        if (dlPctMatch) {
          const pct = parseFloat(dlPctMatch[1]);
          update.progress = Math.min(99, pct);
          update.size = dlPctMatch[2].trim();
          const spMatch = trimmed.match(/\bat\s+([\d.]+\s*(?:[KMGT]i?B|B)\/s)/i);
          if (spMatch) update.speed = spMatch[1].trim();
          update.lastMessage = `${pct.toFixed(1)}% of ${update.size}`;
          entry._lastProgressTime = Date.now();
        }
      }

      if (!fragMatch && !update.progress) {
        const pctOnlyMatch = trimmed.match(/^\[download\]\s+([\d.]+)%/);
        if (pctOnlyMatch) {
          const pct = parseFloat(pctOnlyMatch[1]);
          update.progress = Math.min(99, pct);
          update.lastMessage = `${pct.toFixed(1)}%`;
          entry._lastProgressTime = Date.now();
        }
      }

      const durationMatch = trimmed.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
      if (durationMatch) {
        const totalSecs =
          parseInt(durationMatch[1]) * 3600 +
          parseInt(durationMatch[2]) * 60 +
          parseFloat(durationMatch[3]);
        if (totalSecs > 0) entry._ffmpegTotalSecs = totalSecs;
        return;
      }

      const ffmpegMatch = trimmed.match(/size=\s*([\d.]+\s*\w+)\s+time=(\d+):(\d+):([\d.]+)/i);
      if (ffmpegMatch) {
        const elapsedSecs =
          parseInt(ffmpegMatch[2]) * 3600 +
          parseInt(ffmpegMatch[3]) * 60 +
          parseFloat(ffmpegMatch[4]);
        const totalSecs = entry._ffmpegTotalSecs || 0;
        if (totalSecs > 0) {
          update.progress = Math.min(99, (elapsedSecs / totalSecs) * 100);
        }
        const rawSize = ffmpegMatch[1].trim();
        const kbMatch = rawSize.match(/([\d.]+)\s*kB/i);
        if (kbMatch) {
          const mb = parseFloat(kbMatch[1]) / 1024;
          update.size = mb >= 1024 ? `${(mb / 1024).toFixed(1)} GiB` : `${mb.toFixed(1)} MiB`;
        } else {
          update.size = rawSize;
        }
        const speedXMatch = trimmed.match(/speed=\s*([\d.]+)x/i);
        if (speedXMatch) update.speed = `${speedXMatch[1]}x`;
        update.lastMessage = `Processing… ${update.size}${update.speed ? ` at ${update.speed}` : ''}`;
        entry._lastProgressTime = Date.now();
      }

      const retryMatch =
        trimmed.match(/Retrying\s+\(\d+\/\d+\)/i) ||
        trimmed.match(/Got error:.*timed?\s*out/i) ||
        trimmed.match(/Read timed? out/i);
      if (retryMatch) {
        update.speed = '0 MB/s';
        const retryNumMatch = trimmed.match(/Retrying\s+\((\d+)\/(\d+)\)/i);
        update.lastMessage = retryNumMatch
          ? `Retrying… (${retryNumMatch[1]}/${retryNumMatch[2]})`
          : 'Retrying…';
        sendProgress({ id, progress: entry.progress, ...update, status: entry.status });
        persistProgress();
        return;
      }

      const speedMatch = trimmed.match(/\bat\s+([\d.]+\s*(?:[KMGT]i?B|B)\/s)/i);
      if (speedMatch) update.speed = speedMatch[1].trim();

      const sizeMatch = trimmed.match(/\bof\s+~?\s*([\d.]+\s*(?:[KMGT]i?B|B))\b/i);
      if (sizeMatch) update.size = sizeMatch[1].trim();

      const fragTotalMatch = trimmed.match(/Total fragments:\s+(\d+)/);
      if (fragTotalMatch) {
        const total = parseInt(fragTotalMatch[1]);
        const u = {
          totalFragments: total,
          completedFragments: 0,
          lastMessage: `HLS: ${total} fragments`,
        };
        sendProgress({ id, progress: entry.progress, ...u, status: entry.status });
        persistProgress();
        return;
      }

      const destMatch = trimmed.match(/^\[download\] Destination:\s+(.+)/);
      if (destMatch) {
        const u = {
          filePath: destMatch[1].trim(),
          lastMessage: 'Downloading…',
        };
        sendProgress({ id, progress: entry.progress, ...u, status: entry.status });
        persistProgress();
        return;
      }

      const mergeMatch = trimmed.match(/\[Merger\] Merging formats into "(.+)"/);
      if (mergeMatch) {
        const u = {
          filePath: mergeMatch[1].trim(),
          lastMessage: 'Merging…',
          progress: 99,
        };
        sendProgress({ id, ...u, status: entry.status });
        persistProgress();
        return;
      }

      const SUPPRESS_PATTERNS = [
        /Sleeping\s+[\d.]+\s+seconds/i,
        /^\[yt-dlp\s+DEBUG\]/i,
        /^\[debug\]/i,
        /^\[ExtractAudio\]/i,
        /^\[Merger\]/i,
        /^\[Fixup\]/i,
        /^\[info\]\s/i,
        /^\[hlsnative\]\s/i,
      ];
      if (Object.keys(update).length === 0) {
        const suppress =
          (entry.lastMessage || '').startsWith('Fragment') ||
          (entry.lastMessage || '').startsWith('Retrying') ||
          SUPPRESS_PATTERNS.some((p) => p.test(trimmed));
        if (!suppress) update.lastMessage = trimmed;
      }

      if (Object.keys(update).length > 0) {
        Object.assign(entry, update);
        sendProgress({ id, ...update, status: entry.status });
        persistProgress();
      }
    };

    let buf = '';
    let stderrBuf = '';

    const appendLog = (line) => {
      try {
        fs.appendFileSync(logPath, line + '\n', 'utf8');
      } catch {}
    };

    proc.stdout.on('data', (chunk) => {
      buf += chunk.toString();
      const lines = buf.split(/\r\n|\r|\n/);
      buf = lines.pop();
      lines.forEach((l) => {
        appendLog(`[stdout] ${l}`);
        handleLine(l);
      });
    });
    proc.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderrBuf += text;
      text.split(/\r\n|\r|\n/).forEach((l) => {
        appendLog(`[stderr] ${l}`);
        handleLine(l);
      });
    });

    proc.on('error', (err) => {
      clearInterval(stuckTimer);
      activeProcs.delete(id);
      const msg =
        err.code === 'EACCES'
          ? `Permission denied, binary is not executable: ${binaryPath}`
          : err.code === 'ENOENT'
            ? `Binary not found: ${binaryPath}`
            : `Failed to start downloader: ${err.message}`;
      entry.status = 'error';
      entry.completedAt = Date.now();
      entry.lastMessage = msg;
      appendLog(msg);
      sendProgress({ id, progress: entry.progress, status: 'error', lastMessage: msg });
      persistProgress();
    });

    proc.on('close', (code) => {
      clearInterval(stuckTimer);
      activeProcs.delete(id);
      if (buf.trim()) {
        appendLog(buf.trim());
        handleLine(buf.trim());
      }

      const status = code === 0 ? 'completed' : 'error';
      entry.status = status;
      entry.completedAt = Date.now();
      if (code === 0) {
        entry.progress = 100;
        entry.logPath = null;
        try {
          fs.unlinkSync(logPath);
        } catch {}
      } else {
        try {
          fs.appendFileSync(
            logPath,
            `${'─'.repeat(60)}\nFailed: exit code ${code}\nFinished: ${new Date().toISOString()}\n`,
            'utf8'
          );
        } catch {}
        const errorLine =
          stderrBuf
            .split(/\r\n|\r|\n/)
            .map((l) => l.trim())
            .filter(Boolean)
            .reverse()
            .find((l) => /error|failed|unable|cannot|denied/i.test(l)) || '';
        const prev = entry.lastMessage || '';
        const base = errorLine || prev;
        entry.lastMessage = base
          ? `${base} (exit ${code})`
          : `Download failed (exit code ${code})`;
      }

      if (code === 0 && !entry.filePath) {
        try {
          const VIDEO_EXTS = ['.mp4', '.mkv', '.webm', '.avi', '.ts', '.m4v'];
          const match = fs
            .readdirSync(downloadPath)
            .filter((f) => VIDEO_EXTS.some((e) => f.toLowerCase().endsWith(e)))
            .map((f) => ({
              f,
              mtime: fs.statSync(path.join(downloadPath, f)).mtimeMs,
            }))
            .sort((a, b) => b.mtime - a.mtime)[0];
          if (match) entry.filePath = path.join(downloadPath, match.f);
        } catch {}
      }

      if (code === 0 && entry.filePath) {
        try {
          const ext = path.extname(entry.filePath) || '.mp4';
          const safeName = name
            .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          if (safeName) {
            const newPath = path.join(downloadPath, safeName + ext);
            if (newPath !== entry.filePath) {
              fs.renameSync(entry.filePath, newPath);
              entry.filePath = newPath;
            }
          }
        } catch {}
      }

      if (code === 0 && entry.filePath && entry.mediaType === 'tv') {
        try {
          const seasonDir = path.dirname(downloadPath);
          const fileName = path.basename(entry.filePath);
          const finalPath = path.join(seasonDir, fileName);
          if (finalPath !== entry.filePath) {
            fs.renameSync(entry.filePath, finalPath);
            entry.filePath = finalPath;
          }
          fs.rmSync(downloadPath, { recursive: true, force: true });
        } catch {}
      }

      if (entry.filePath) {
        try {
          const bytes = fs.statSync(entry.filePath).size;
          entry.size =
            bytes > 1e9
              ? (bytes / 1e9).toFixed(2) + ' GB'
              : bytes > 1e6
                ? (bytes / 1e6).toFixed(1) + ' MB'
                : bytes > 1e3
                  ? (bytes / 1e3).toFixed(1) + ' KB'
                  : bytes + ' B';
        } catch {}
      }

      sendProgress({
        id,
        name,
        status: entry.status,
        progress: entry.progress,
        completedAt: entry.completedAt,
        filePath: entry.filePath,
        size: entry.size,
        completedFragments: entry.completedFragments,
        totalFragments: entry.totalFragments,
        lastMessage: entry.lastMessage,
        logPath: entry.logPath,
      });
      persistProgress();
    });

    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function cleanupPartialFiles(entry) {
  if (!entry) return;
  if (entry.filePath && fs.existsSync(entry.filePath)) {
    try { fs.unlinkSync(entry.filePath); } catch {}
  }
  if (entry.downloadPath && entry.name) {
    try {
      const entries = fs.readdirSync(entry.downloadPath, { withFileTypes: true });
      const namePrefix = entry.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim();
      const rawPrefix = entry.name;
      for (const dirent of entries) {
        const fileName = dirent.name;
        if (!fileName.startsWith(namePrefix) && !fileName.startsWith(rawPrefix)) continue;
        const fullPath = path.join(entry.downloadPath, fileName);
        try {
          if (dirent.isDirectory()) {
            fs.rmSync(fullPath, { recursive: true });
          } else {
            fs.unlinkSync(fullPath);
          }
        } catch {}
      }
    } catch {}
  }
}

function stopDownload(id) {
  const proc = activeProcs.get(id);
  if (proc) {
    try {
      if (process.platform === 'win32') {
        require('child_process').execSync(`taskkill /pid ${proc.pid} /t /f`, { stdio: 'ignore' });
      } else {
        try { process.kill(-proc.pid, 'SIGKILL'); } catch {
          try { process.kill(proc.pid, 'SIGKILL'); } catch {}
        }
      }
    } catch {}
  }
  activeProcs.delete(id);
}

function isDownloadActive(id) {
  const proc = activeProcs.get(id);
  if (!proc) return false;
  try {
    process.kill(proc.pid, 0);
    return true;
  } catch {
    activeProcs.delete(id);
    return false;
  }
}

function cancelDownload(id) {
  const proc = activeProcs.get(id);
  if (proc) {
    try {
      if (process.platform === 'win32') {
        require('child_process').execSync(`taskkill /pid ${proc.pid} /t /f`, { stdio: 'ignore' });
      } else {
        try { process.kill(-proc.pid, 'SIGKILL'); } catch {
          try { process.kill(proc.pid, 'SIGKILL'); } catch {}
        }
      }
    } catch {}
    activeProcs.delete(id);
  }
}

function killAllDownloads() {
  const ids = Array.from(activeProcs.keys());
  for (const id of ids) {
    stopDownload(id);
  }
}

module.exports = {
  checkDownloader,
  runDownload,
  cancelDownload,
  stopDownload,
  killAllDownloads,
  getBundledBinaryPath,
  isDownloadActive,
  cleanupPartialFiles,
};
