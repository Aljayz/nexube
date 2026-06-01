const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { app } = require('electron');

let ffmpegPath = null;
let ffprobePath = null;
try {
  const resolved = require('ffmpeg-static');
  if (resolved && typeof resolved === 'string' && fs.existsSync(resolved)) {
    ffmpegPath = resolved;
  }
} catch {}
try {
  const resolved = require('ffprobe-installer');
  if (resolved && resolved.path && fs.existsSync(resolved.path)) {
    ffprobePath = resolved.path;
  }
} catch {}

function resolveToolBinary(binaryPath) {
  if (!binaryPath) {
    diag('resolveToolBinary: no path provided');
    return null;
  }
  try {
    fs.accessSync(binaryPath, fs.constants.X_OK);
    diag('resolveToolBinary: using binary:', binaryPath);
    return binaryPath;
  } catch {}
  try {
    const dest = path.join(app.getPath('userData'), path.basename(binaryPath));
    if (!fs.existsSync(dest)) {
      diag('resolveToolBinary: extracting binary to', dest);
      fs.copyFileSync(binaryPath, dest);
      try { fs.chmodSync(dest, 0o755); } catch {}
    }
    diag('resolveToolBinary: extracted to:', dest);
    return dest;
  } catch (e) {
    diag('resolveToolBinary: cannot extract binary:', binaryPath, e.message);
    return null;
  }
}

const activeProcs = new Map();
const binaryTokenRegistry = new Map();

let _diagCallback = null;
function setDiagCallback(cb) {
  _diagCallback = cb;
}
function diag(...args) {
  const msg = '[remux-diag] ' + args.join(' ');
  console.log(msg);
  if (_diagCallback) _diagCallback(msg);
}

function generateToken() {
  return crypto.randomUUID();
}

function registerBinaryPath(binaryPath) {
  const token = generateToken();
  binaryTokenRegistry.set(token, binaryPath);
  setTimeout(() => binaryTokenRegistry.delete(token), 10 * 60 * 1000);
  return token;
}

function resolveBinaryPath(token) {
  return binaryTokenRegistry.get(token) || null;
}

function getBundledBinaryPath() {
  const platform = process.platform;
  const exeName = platform === 'win32' ? 'desk-vid-dl.exe' : 'desk-vid-dl';

  // Packaged mode: process.resourcesPath/desk-vid-dl/desk-vid-dl
  if (process.resourcesPath) {
    const pkgPath = path.join(process.resourcesPath, 'desk-vid-dl', exeName);
    if (fs.existsSync(pkgPath)) return pkgPath;
  }

  // Dev mode: relative to this file's location
  const devResourcePath = path.resolve(__dirname, '../../resources');
  for (const subdir of ['linux', 'windows', 'darwin']) {
    const devPath = path.join(devResourcePath, 'desk-vid-dl', subdir, 'desk-vid-dl', exeName);
    if (fs.existsSync(devPath)) return devPath;
  }

  return null;
}

function _checkDownloader(folderPath) {
  if (!folderPath) return { exists: false, reason: 'no_folder' };
  let entries;
  try {
    entries = fs.readdirSync(folderPath);
  } catch (e) {
    return { exists: false, reason: e.code === 'EACCES' ? 'folder_permission' : 'folder_unreadable' };
  }
  if (!entries.includes('_internal')) {
    return { exists: false, reason: 'no_internal' };
  }
  const KNOWN_BINARIES = ['desk-vid-dl', 'vid-dl'];
  // Prefer known binary names first
  for (const known of KNOWN_BINARIES) {
    if (entries.includes(known)) {
      const fullPath = path.join(folderPath, known);
      try {
        if (fs.statSync(fullPath).isFile()) {
          return { exists: true, binaryPath: fullPath };
        }
      } catch {}
    }
  }
  // Fall back to any executable in the directory
  const binary = entries.find((e) => {
    if (e === '_internal' || e.startsWith('.')) return false;
    try {
      const stat = fs.statSync(path.join(folderPath, e));
      if (!stat.isFile()) return false;
      if (process.platform === 'win32') return e.endsWith('.exe');
      return !!(stat.mode & 0o111);
    } catch {
      return false;
    }
  });
  if (!binary) return { exists: false, reason: 'no_executable' };
  return { exists: true, binaryPath: path.join(folderPath, binary) };
}

function isMpegTs(filePath) {
  const bin = resolveToolBinary(ffprobePath);
  if (!bin || !filePath || !fs.existsSync(filePath)) {
    diag('isMpegTs skip: bin=', !!bin, 'file=', !!filePath, 'exists=', filePath ? fs.existsSync(filePath) : false);
    return Promise.resolve(false);
  }
  diag('isMpegTs probing with binary:', bin, 'file:', filePath);
  return new Promise((resolve) => {
    const proc = spawn(bin, [
      '-v', 'error',
      '-show_entries', 'format=format_name',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ], { stdio: 'pipe' });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    proc.on('close', (code) => {
      const format = stdout.trim();
      const isTs = code === 0 && format === 'mpegts';
      diag('ffprobe result:', { code, format, isTs, stderr: stderr.trim() });
      resolve(isTs);
    });
    proc.on('error', (err) => {
      diag('ffprobe spawn error:', { binary: bin, error: err.message, code: err.code });
      resolve(false);
    });
  });
}

function ffmpegRemux(ffmpeg, sourcePath, destPath) {
  diag('ffmpegRemux: starting', { ffmpeg, sourcePath, destPath });
  return new Promise((resolve) => {
    const tmpPath = destPath + '.remux.tmp';
    const proc = spawn(ffmpeg, [
      '-i', sourcePath,
      '-c', 'copy',
      '-movflags', '+faststart',
      '-y',
      tmpPath,
    ], { stdio: 'pipe' });
    let stderr = '';
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(tmpPath)) {
        try {
          fs.renameSync(tmpPath, destPath);
          diag('ffmpegRemux: success');
          resolve(true);
        } catch (e) {
          diag('ffmpegRemux: rename failed:', e.message);
          try { fs.unlinkSync(tmpPath); } catch {}
          resolve(false);
        }
      } else {
        diag('ffmpegRemux: failed', { code, stderr: stderr.slice(-500) });
        try { fs.unlinkSync(tmpPath); } catch {}
        resolve(false);
      }
    });
    proc.on('error', (err) => {
      diag('ffmpegRemux: spawn error:', err.message);
      try { fs.unlinkSync(tmpPath); } catch {}
      resolve(false);
    });
  });
}

function remuxToMp4(filePath) {
  const ffmpeg = resolveToolBinary(ffmpegPath);
  if (!ffmpeg || !filePath || !fs.existsSync(filePath)) {
    diag('remuxToMp4 skip: ffmpeg=', !!ffmpeg, 'file=', !!filePath, 'exists=', filePath ? fs.existsSync(filePath) : false);
    return Promise.resolve(false);
  }
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.mp4' && ext !== '.ts' && ext !== '.mkv' && ext !== '.m4v') {
    diag('remuxToMp4 skip: unsupported extension', ext);
    return Promise.resolve(false);
  }
  const probeBin = resolveToolBinary(ffprobePath);
  const needsRemux = !probeBin;
  diag('remuxToMp4 ffprobe=', !!probeBin, 'needsRemux=', needsRemux, 'file=', filePath);
  if (needsRemux) diag('ffprobe unavailable, always remuxing');
  return (needsRemux ? Promise.resolve(true) : isMpegTs(filePath)).then((isTs) => {
    diag('remuxToMp4 isTs=', isTs, '→', isTs ? 'ffmpeg remux' : 'skip');
    if (!isTs) return true;
    diag('is mpegts, remuxing...');
    const tmpPath = filePath + '.remux.mp4';
    return ffmpegRemux(ffmpeg, filePath, tmpPath).then((ok) => {
      if (!ok) return false;
      if (ext !== '.mp4') {
        fs.unlinkSync(filePath);
        const mp4Target = path.join(path.dirname(filePath), path.parse(filePath).name + '.mp4');
        fs.renameSync(tmpPath, mp4Target);
        diag('renamed', path.basename(filePath), '→', path.basename(mp4Target));
        return mp4Target;
      } else {
        fs.renameSync(tmpPath, filePath);
        return true;
      }
    });
  });
}

function remuxToFile(sourcePath, destPath) {
  diag('remuxToFile: start', { sourcePath, destPath });
  const ffmpeg = resolveToolBinary(ffmpegPath);
  if (!ffmpeg || !sourcePath || !fs.existsSync(sourcePath)) {
    diag('remuxToFile skip: ffmpeg=', !!ffmpeg, 'source=', !!sourcePath, 'exists=', sourcePath ? fs.existsSync(sourcePath) : false);
    return Promise.resolve(false);
  }
  try { fs.mkdirSync(path.dirname(destPath), { recursive: true }); } catch {}
  const probeBin = resolveToolBinary(ffprobePath);
  const needsRemux = !probeBin;
  diag('remuxToFile ffprobe=', !!probeBin, 'needsRemux=', needsRemux);
  if (needsRemux) diag('remuxToFile ffprobe unavailable, always remuxing');
  return (needsRemux ? Promise.resolve(true) : isMpegTs(sourcePath)).then((isTs) => {
    diag('remuxToFile isTs=', isTs, '→', isTs ? 'ffmpeg remux' : 'copy');
    if (isTs) {
      diag('remuxToFile remuxing to', destPath);
      return ffmpegRemux(ffmpeg, sourcePath, destPath);
    }
    diag('remuxToFile already proper mp4, copying');
    try {
      fs.copyFileSync(sourcePath, destPath);
      return true;
    } catch (e) {
      diag('remuxToFile copy failed:', e.message);
      return false;
    }
  });
}

function checkDownloader(folderPath) {
  const result = _checkDownloader(folderPath);
  if (!result.exists) return result;
  const token = registerBinaryPath(result.binaryPath);
  return { exists: true, token };
}

function checkBundledAndRegister() {
  const bundledPath = getBundledBinaryPath();
  if (!bundledPath) return { exists: false, reason: 'no_bundled' };
  const result = _checkDownloader(path.dirname(bundledPath));
  if (!result.exists) return result;
  const token = registerBinaryPath(result.binaryPath);
  return { exists: true, token };
}

function sanitizeFilename(name) {
  return name.replace(/['"\\/:?*<>|]/g, '').trim();
}

function startDownload({
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
  formatSpec,
  downloadId,
  initialProgress,
  cookies,
  referer,
}, sendProgress, getDownloads, updateDownloadEntry, persistDownload) {
  try {
    name = sanitizeFilename(name);
    const id = downloadId || crypto.randomUUID();

    if (activeProcs.has(id)) {
      return { ok: false, error: 'Download already in progress', id };
    }

    const logPath = path.join(os.tmpdir(), `nexube_desk_dl_${id}.log`);

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
      lastMessage: initialProgress ? `Resuming at ${initialProgress.toFixed(1)}%...` : 'Starting\u2026',
      startedAt: Date.now(),
      completedAt: null,
      mediaId: mediaId || null,
      mediaType: mediaType || null,
      season: season || null,
      episode: episode || null,
      posterPath: posterPath || null,
      tmdbId: tmdbId || mediaId || null,
      logPath,
      _lastProgressTime: Date.now(),
      _paused: false,
      _stdin: null,
    };

    try {
      fs.writeFileSync(
        logPath,
        `Nexube Desk Download Log\nName: ${name}\nURL: ${m3u8Url}\nStarted: ${new Date().toISOString()}\n${'\u2500'.repeat(60)}\n`,
        'utf8'
      );
    } catch {}

    updateDownloadEntry(id, entry);

    const persistProgress = () => {
      if (!persistDownload) return;
      try {
        const dbStatus = entry.status === 'stopped' || entry.status === 'killed' ? 'cancelled' : entry.status;
        persistDownload(id, {
          status: dbStatus,
          progressPercent: entry.progress,
          speed: entry.speed || null,
          filePath: entry.filePath || null,
          size: typeof entry.size === 'string' ? 0 : entry.size || 0,
          startedAt: entry.startedAt ? new Date(entry.startedAt).toISOString() : null,
          completedAt: entry.completedAt ? new Date(entry.completedAt).toISOString() : null,
          error: entry.lastMessage || null,
        });
      } catch {}
    };

    const args = [
      m3u8Url,
      '-o', path.join(downloadPath, name),
      '-f', formatSpec || 'bestvideo*+bestaudio/best',
    ];
    if (referer) {
      args.push('--referer', referer);
    }
    if (cookies) {
      const cookieStr = typeof cookies === 'string' ? cookies : String(cookies);
      if (cookieStr.length > 0) {
        args.push('--cookie-string', cookieStr);
      }
    }

    console.log(`[desk-downloader] spawning: ${binaryPath} ${args.join(' ')}`);

    // Ensure binary has execute permission (important for AppImage/deb)
    try {
      fs.chmodSync(binaryPath, 0o755);
    } catch {}

    const env = { ...process.env };
    if (ffmpegPath) {
      env.PATH = `${path.dirname(ffmpegPath)}:${env.PATH || ''}`;
    }
    const proc = spawn(binaryPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
      env,
    });
    entry._stdin = proc.stdin;
    activeProcs.set(id, proc);

    if (persistDownload) {
      try {
        persistDownload(id, { processId: proc.pid });
      } catch {}
    }

    const STUCK_TIMEOUT_MS = 15000;
    const STUCK_CHECK_INTERVAL_MS = 5000;
    const stuckTimer = setInterval(() => {
      if (entry.status !== 'downloading') {
        clearInterval(stuckTimer);
        return;
      }
      const elapsed = Date.now() - entry._lastProgressTime;
      if (elapsed > STUCK_TIMEOUT_MS && Date.now() - entry.startedAt > STUCK_TIMEOUT_MS) {
        let msg = `Download stuck \u2014 no progress for ${Math.round(elapsed / 1000)}s`;
        try {
          const logContent = fs.readFileSync(logPath, 'utf8').trim();
          const errorLines = logContent.split('\n').filter(l => l.startsWith('[stderr]'));
          if (errorLines.length > 0) {
            msg += ': ' + errorLines.slice(0, 3).join('; ');
          }
        } catch {}
        entry.status = 'error';
        entry.completedAt = Date.now();
        entry.lastMessage = msg;
        killDownload(id);
        sendProgress({ id, status: 'error', lastMessage: msg, progress: entry.progress });
        persistProgress();
        clearInterval(stuckTimer);
        try { fs.appendFileSync(logPath, `\n${msg}\nFinished: ${new Date().toISOString()}\n`); } catch {}
      }
    }, STUCK_CHECK_INTERVAL_MS);

    let buf = '';

    const appendLog = (line) => {
      try {
        fs.appendFileSync(logPath, line + '\n', 'utf8');
      } catch {}
    };

    proc.stdout.on('data', (chunk) => {
      buf += chunk.toString();
      const lines = buf.split(/\r?\n/);
      buf = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        appendLog(`[stdout] ${line}`);
        try {
          const msg = JSON.parse(line);
          handleMessage(msg, entry, sendProgress, persistProgress, id, appendLog);
        } catch {
          appendLog(`[stdout-raw] ${line}`);
        }
      }
    });

    proc.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      appendLog(`[stderr] ${text.trim()}`);
    });

    proc.on('error', (err) => {
      clearInterval(stuckTimer);
      activeProcs.delete(id);
      const msg = err.code === 'EACCES'
        ? `Permission denied: ${binaryPath}`
        : err.code === 'ENOENT'
          ? `Binary not found: ${binaryPath}`
          : `Failed to start: ${err.message}`;
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
      entry._stdin = null;

      if (entry.status === 'paused') {
        entry.status = 'stopped';
        entry.lastMessage = 'Download paused then stopped';
      }

      if (code === 0 && entry.status !== 'error' && entry.status !== 'stopped') {
        entry.status = 'completed';
        entry.progress = 100;
        entry.completedAt = Date.now();
        entry.lastMessage = 'Completed';
        try {
          fs.unlinkSync(logPath);
        } catch {}
      } else if (!entry.completedAt) {
        entry.completedAt = Date.now();
        if (entry.status === 'downloading') {
          entry.status = 'error';
          entry.lastMessage = `Process exited with code ${code}`;
          try {
            const logContent = fs.readFileSync(logPath, 'utf8').trim();
            const errorLines = logContent.split('\n').filter(l => l.startsWith('[stderr]'));
            if (errorLines.length > 0) {
              entry.lastMessage += ': ' + errorLines.slice(0, 3).join('; ');
            }
          } catch {}
        }
      }

      if (entry.status === 'completed' && !entry.filePath) {
        try {
          const VIDEO_EXTS = ['.mp4', '.mkv', '.webm', '.avi', '.ts', '.m4v'];
          const match = fs.readdirSync(downloadPath)
            .filter((f) => VIDEO_EXTS.some((e) => f.toLowerCase().endsWith(e)))
            .map((f) => ({ f, mtime: fs.statSync(path.join(downloadPath, f)).mtimeMs }))
            .sort((a, b) => b.mtime - a.mtime)[0];
          if (match) entry.filePath = path.join(downloadPath, match.f);
        } catch {}
      }

      if (entry.filePath) {
        try {
          const bytes = fs.statSync(entry.filePath).size;
          entry.size = bytes > 1e9
            ? (bytes / 1e9).toFixed(2) + ' GB'
            : bytes > 1e6
              ? (bytes / 1e6).toFixed(1) + ' MB'
              : bytes > 1e3
                ? (bytes / 1e3).toFixed(1) + ' KB'
                : bytes + ' B';
        } catch {}
      }

      const finish = () => {
        if (entry.filePath) {
          try {
            const bytes = fs.statSync(entry.filePath).size;
            entry.size = bytes > 1e9
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
          lastMessage: entry.lastMessage,
          logPath: entry.logPath,
        });
        persistProgress();
      };

      if (entry.status === 'completed' && entry.filePath) {
        remuxToMp4(entry.filePath).then((result) => {
          if (result && result !== true) entry.filePath = result;
        }).finally(finish);
      } else {
        finish();
      }
    });

    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function handleMessage(msg, entry, sendProgress, persistProgress, id, appendLog) {
  const type = msg.type;
  console.log(`[desk-downloader:${id}] ${type}:`, JSON.stringify(msg));

  if (type === 'progress') {
    if (msg.status === 'finished') {
      entry.progress = 100;
      entry.status = 'completed';
      entry.completedAt = Date.now();
      entry.lastMessage = 'Completed';
      entry._lastProgressTime = Date.now();
      sendProgress({ id, status: 'completed', progress: 100, lastMessage: 'Completed' });
      persistProgress();
      return;
    }
    entry.progress = msg.pct;
    entry._lastProgressTime = Date.now();
    if (msg.speed) {
      const bps = msg.speed;
      entry.speed = bps > 1e9
        ? (bps / 1e9).toFixed(1) + ' GB/s'
        : bps > 1e6
          ? (bps / 1e6).toFixed(1) + ' MB/s'
          : bps > 1e3
            ? (bps / 1e3).toFixed(1) + ' KB/s'
            : bps + ' B/s';
    }
    if (msg.total_bytes) {
      const bytes = msg.total_bytes;
      entry.size = bytes > 1e9
        ? (bytes / 1e9).toFixed(2) + ' GB'
        : bytes > 1e6
          ? (bytes / 1e6).toFixed(1) + ' MB'
          : bytes > 1e3
            ? (bytes / 1e3).toFixed(1) + ' KB'
            : bytes + ' B';
    }
    entry.lastMessage = `${msg.pct.toFixed(1)}% at ${entry.speed}`;

    sendProgress({ id, ...msg, status: entry.status, lastMessage: entry.lastMessage });
    persistProgress();
  }

  if (type === 'state') {
    entry._paused = msg.paused;
    entry.status = msg.paused ? 'paused' : 'downloading';
    entry.lastMessage = msg.paused ? 'Paused' : 'Resumed';
    sendProgress({ id, status: entry.status, lastMessage: entry.lastMessage, progress: entry.progress });
    persistProgress();
  }

  if (type === 'done') {
    entry.filePath = msg.filepath;
    entry.progress = 100;
    entry.status = 'completed';
    entry.completedAt = Date.now();
    entry.lastMessage = 'Completed';
    entry._lastProgressTime = Date.now();
    sendProgress({ id, status: 'completed', progress: 100, filePath: msg.filepath, lastMessage: 'Completed' });
    persistProgress();
    if (entry._stdin) {
      try { entry._stdin.end(); } catch {}
    }
    if (entry.downloadPath) {
      try {
        const dirEntries = fs.readdirSync(entry.downloadPath, { withFileTypes: true });
        for (const dirent of dirEntries) {
          if (dirent.name.includes('.part-Frag') || dirent.name.includes('.part.')) {
            try { fs.unlinkSync(path.join(entry.downloadPath, dirent.name)); } catch {}
          }
        }
      } catch {}
    }
  }

  if (type === 'error') {
    entry.status = 'error';
    entry.lastMessage = msg.message;
    entry.completedAt = Date.now();
    appendLog(`[error] ${msg.message}`);
    sendProgress({ id, status: 'error', lastMessage: msg.message, progress: entry.progress });
    persistProgress();
  }

  if (type === 'stopped') {
    entry.status = 'stopped';
    entry.lastMessage = 'Stopped';
    entry.completedAt = Date.now();
    sendProgress({ id, status: 'stopped', lastMessage: 'Stopped', progress: entry.progress });
    persistProgress();
  }
}

function pauseDownload(id) {
  const proc = activeProcs.get(id);
  if (!proc || !proc.stdin.writable) return false;
  try {
    proc.stdin.write(JSON.stringify({ cmd: 'pause' }) + '\n');
    return true;
  } catch {
    return false;
  }
}

function resumeDownload(id) {
  const proc = activeProcs.get(id);
  if (!proc || !proc.stdin.writable) return false;
  try {
    proc.stdin.write(JSON.stringify({ cmd: 'resume' }) + '\n');
    return true;
  } catch {
    return false;
  }
}

function stopDownload(id) {
  const proc = activeProcs.get(id);
  if (!proc || !proc.stdin.writable) {
    activeProcs.delete(id);
    return true;
  }
  try {
    proc.stdin.write(JSON.stringify({ cmd: 'stop' }) + '\n');
    return true;
  } catch {
    return false;
  }
}

function killDownload(id) {
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
    return true;
  }
  return false;
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

function cleanupPartialFiles(entry) {
  if (!entry) return;
  const dirsToCheck = [];

  if (entry.filePath && fs.existsSync(entry.filePath)) {
    try { fs.unlinkSync(entry.filePath); } catch {}
  }

  if (entry.downloadPath) {
    dirsToCheck.push(entry.downloadPath);
    try {
      const entries = fs.readdirSync(entry.downloadPath, { withFileTypes: true });
      for (const dirent of entries) {
        const fullPath = path.join(entry.downloadPath, dirent.name);
        if (dirent.isDirectory()) {
          try { fs.rmSync(fullPath, { recursive: true, force: true }); } catch {}
        } else if (
          dirent.name.includes('.part-Frag') ||
          dirent.name.endsWith('.part') ||
          dirent.name.endsWith('.ytdl') ||
          dirent.name.endsWith('.frag') ||
          dirent.name.endsWith('.temp') ||
          dirent.name.endsWith('.mp4') ||
          dirent.name.endsWith('.mkv') ||
          dirent.name.endsWith('.webm') ||
          dirent.name.endsWith('.ts') ||
          dirent.name.endsWith('.m4v')
        ) {
          try { fs.unlinkSync(fullPath); } catch {}
        }
      }
    } catch {}
  }

  for (const dir of dirsToCheck) {
    try {
      if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
        fs.rmdirSync(dir);
      }
    } catch {}
  }

  if (entry.mediaType === 'tv' && entry.downloadPath) {
    try {
      const seasonDir = path.dirname(entry.downloadPath);
      const showDir = path.dirname(seasonDir);
      for (const d of [seasonDir, showDir]) {
        if (fs.existsSync(d) && fs.readdirSync(d).length === 0) {
          fs.rmdirSync(d);
        }
      }
    } catch {}
  }
}

function killAllDownloads() {
  for (const id of Array.from(activeProcs.keys())) {
    killDownload(id);
  }
}

module.exports = {
  checkDownloader,
  checkBundledAndRegister,
  resolveBinaryPath,
  startDownload,
  pauseDownload,
  resumeDownload,
  stopDownload,
  killDownload,
  isDownloadActive,
  cleanupPartialFiles,
  killAllDownloads,
  getBundledBinaryPath,
  remuxToMp4,
  remuxToFile,
  isMpegTs,
  setDiagCallback,
};
