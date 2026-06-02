import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward, Maximize, Minimize, X, ChevronDown, ChevronUp, Copy, PictureInPicture2, ChevronLeft, ChevronRight, Info, Upload, Trash2 } from 'lucide-react';

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function parseVtt(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const cues = [];
  let i = 0;
  while (i < lines.length && !lines[i].trim().startsWith('WEBVTT')) i++;
  i++;

  let currentId = null;
  let currentStart = null;
  let currentEnd = null;
  let currentText = [];

  function parseTimestamp(str) {
    const parts = str.trim().split(':');
    if (parts.length === 3) {
      const [h, m, s] = parts;
      return parseFloat(h) * 3600 + parseFloat(m) * 60 + parseFloat(s);
    }
    if (parts.length === 2) {
      const [m, s] = parts;
      return parseFloat(m) * 60 + parseFloat(s);
    }
    return 0;
  }

  function pushCue() {
    if (currentStart != null && currentEnd != null && currentText.length > 0) {
      cues.push({
        id: currentId,
        start: currentStart,
        end: currentEnd,
        text: currentText.join('\n'),
      });
    }
    currentId = null;
    currentStart = null;
    currentEnd = null;
    currentText = [];
  }

  for (; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === '') {
      pushCue();
      continue;
    }

    const arrowMatch = trimmed.match(/^(\d{1,2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?)\s*-->\s*(\d{1,2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?)/);
    if (arrowMatch) {
      currentStart = parseTimestamp(arrowMatch[1]);
      currentEnd = parseTimestamp(arrowMatch[2]);
      continue;
    }

    if (currentStart == null) {
      currentId = trimmed;
    } else {
      currentText.push(trimmed);
    }
  }
  pushCue();

  return cues;
}

function srtToVtt(srt) {
  let vtt = 'WEBVTT\n\n';
  vtt += srt
    .replace(/\r\n/g, '\n')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/\n\n+/g, '\n\n')
    .trim();
  return vtt;
}

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

export default function LocalPlayer({ filePath, title, onClose, onVideoEnded, subtitles, downloadId }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const hideTimerRef = useRef(null);
  const saveTimerRef = useRef(null);
  const rafRef = useRef(null);
  const longPressRef = useRef(null);
  const fileInputRef = useRef(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState(null);
  const [errorDetail, setErrorDetail] = useState(null);
  const [showErrorDetail, setShowErrorDetail] = useState(false);
  const [activeSubtitle, setActiveSubtitle] = useState(
    subtitles && subtitles.length > 0 ? subtitles[0].lang : null
  );
  const [speed, setSpeed] = useState(1);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [seekHoverTime, setSeekHoverTime] = useState(null);
  const [resumeOverlay, setResumeOverlay] = useState(null);
  const [showPauseOverlay, setShowPauseOverlay] = useState(true);

  const [subtitleCues, setSubtitleCues] = useState(null);
  const [subtitleOffset, setSubtitleOffset] = useState({});
  const [currentCues, setCurrentCues] = useState([]);
  const [editingOffset, setEditingOffset] = useState(null);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const [uploadedSub, setUploadedSub] = useState(null);
  const [removedSubLangs, setRemovedSubLangs] = useState(new Set());

  const allSubs = useMemo(() => {
    const list = subtitles ? [...subtitles] : [];
    if (uploadedSub) {
      const exists = list.find((s) => s.lang === uploadedSub.lang);
      if (!exists) list.push(uploadedSub);
    }
    return list.filter((s) => !removedSubLangs.has(s.lang));
  }, [subtitles, uploadedSub, removedSubLangs]);

  const offset = activeSubtitle ? (subtitleOffset[activeSubtitle] || 0) : 0;

  const handleOffsetChange = useCallback((newOffset) => {
    setSubtitleOffset((prev) => ({
      ...prev,
      [activeSubtitle]: newOffset,
    }));
  }, [activeSubtitle]);

  // fetch and parse VTT when active subtitle changes
  useEffect(() => {
    if (!activeSubtitle) {
      setSubtitleCues(null);
      setCurrentCues([]);
      return;
    }
    // Check if it's the uploaded subtitle
    if (uploadedSub && activeSubtitle === uploadedSub.lang) {
      setSubtitleCues(uploadedSub.cues);
      return;
    }
    if (!subtitles) {
      setSubtitleCues(null);
      setCurrentCues([]);
      return;
    }
    const sub = subtitles.find((s) => s.lang === activeSubtitle);
    if (!sub) { setSubtitleCues(null); setCurrentCues([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const result = await window.electron?.deskDownloads?.readSubtitle(sub.file);
        if (!result?.success) throw new Error(result?.error || 'Failed to load subtitle');
        if (cancelled) return;
        const text = sub.format === 'srt' ? srtToVtt(result.text) : result.text;
        const cues = parseVtt(text);
        setSubtitleCues(cues);
      } catch (e) {
        console.warn('[subtitle] failed to load:', e.message);
        setSubtitleCues(null);
      }
    })();
    return () => { cancelled = true; };
  }, [activeSubtitle, subtitles, uploadedSub]);

  // RAF loop: match cues against video.currentTime + offset
  useEffect(() => {
    if (!subtitleCues || subtitleCues.length === 0) { setCurrentCues([]); return; }

    function tick() {
      const video = videoRef.current;
      if (!video) { rafRef.current = requestAnimationFrame(tick); return; }
      const adjusted = video.currentTime + offset;
      const matching = [];
      for (const cue of subtitleCues) {
        if (adjusted >= cue.start && adjusted < cue.end) {
          matching.push(cue);
        }
      }
      setCurrentCues(matching);
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [subtitleCues, offset]);

  const handleUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      let text = ev.target.result;
      let cues;
      if (file.name.endsWith('.srt')) {
        text = srtToVtt(text);
      }
      cues = parseVtt(text);
      if (cues.length === 0) return;
      setUploadedSub({
        lang: 'custom',
        label: file.name.replace(/\.(vtt|srt)$/i, ''),
        cues,
      });
      setActiveSubtitle('custom');
      setShowSubtitleMenu(false);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  const handleDeleteSubtitle = useCallback(async (sub) => {
    if (sub.lang === 'custom') {
      setUploadedSub(null);
      if (activeSubtitle === 'custom') setActiveSubtitle(null);
      return;
    }
    try {
      await window.electron?.deskDownloads?.deleteSubtitle(sub.file);
      setRemovedSubLangs((prev) => new Set([...prev, sub.lang]));
      if (activeSubtitle === sub.lang) setActiveSubtitle(null);
    } catch (err) {
      console.warn('[subtitle] failed to delete:', err.message);
    }
  }, [activeSubtitle]);

  const startLongPress = useCallback((dir) => {
    if (longPressRef.current) clearInterval(longPressRef.current);
    longPressRef.current = setInterval(() => {
      handleOffsetChange((subtitleOffset[activeSubtitle] || 0) + dir * 0.1);
    }, 80);
  }, [handleOffsetChange, subtitleOffset, activeSubtitle]);

  const stopLongPress = useCallback(() => {
    if (longPressRef.current) {
      clearInterval(longPressRef.current);
      longPressRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!downloadId) return;
    (async () => {
      try {
        const result = await window.electron?.deskDownloads?.getProgress(downloadId);
        if (result?.success && result.watchedPosition > 10) {
          setResumeOverlay(result.watchedPosition);
        }
      } catch {}
    })();
  }, [downloadId]);

  useEffect(() => {
    if (!downloadId || !playing) return;
    saveTimerRef.current = setInterval(() => {
      const video = videoRef.current;
      if (video && !video.paused) {
        window.electron?.deskDownloads?.saveProgress(downloadId, { position: Math.floor(video.currentTime) });
      }
    }, 5000);
    return () => clearInterval(saveTimerRef.current);
  }, [downloadId, playing]);

  const savePosition = useCallback((pos, finished) => {
    if (!downloadId) return;
    const data = { position: Math.floor(pos != null ? pos : currentTime) };
    if (finished != null) data.finished = finished;
    window.electron?.deskDownloads?.saveProgress(downloadId, data);
  }, [downloadId, currentTime]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      setShowPauseOverlay(false);
    };
    const onDurationChange = () => setDuration(video.duration);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onError = () => {
      const ve = video.error;
      const code = ve ? ve.code : 0;
      const codes = { 1: 'MEDIA_ERR_ABORTED', 2: 'MEDIA_ERR_NETWORK', 3: 'MEDIA_ERR_DECODE', 4: 'MEDIA_ERR_SRC_NOT_SUPPORTED' };
      const msg = codes[code] || `Unknown (${code})`;
      setError('Failed to load video');
      setErrorDetail({ code: msg, message: ve?.message || '', filePath });
    };
    const onEnded = () => {
      setPlaying(false);
      savePosition(duration, true);
      onVideoEnded?.();
    };
    const onCanPlay = () => { setError(null); setErrorDetail(null); };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('error', onError);
    video.addEventListener('ended', onEnded);
    video.addEventListener('canplay', onCanPlay);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('error', onError);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('canplay', onCanPlay);
    };
  }, [filePath]);

  useEffect(() => {
    const handleFsChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (videoRef.current && !videoRef.current.paused && !resumeOverlay) {
      hideTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
    }
  }, [resumeOverlay]);

  useEffect(() => {
    if (playing && !resumeOverlay) {
      resetHideTimer();
    } else {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setControlsVisible(true);
    }
  }, [playing, resumeOverlay, resetHideTimer]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onMouseMove = () => resetHideTimer();
    container.addEventListener('mousemove', onMouseMove);
    return () => container.removeEventListener('mousemove', onMouseMove);
  }, [resetHideTimer]);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); }
    else container.requestFullscreen().catch(() => {});
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (muted) {
      video.volume = volume || 1;
      setMuted(false);
    } else {
      video.volume = 0;
      setMuted(true);
    }
  }, [muted, volume]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const video = videoRef.current;
      if (!video) return;

      switch (e.key) {
        case ' ':
        case 'k':
        case 'K':
          e.preventDefault();
          if (video.paused) { video.play(); setResumeOverlay(null); }
          else video.pause();
          break;
        case 'ArrowLeft':
          if (e.shiftKey && activeSubtitle) {
            e.preventDefault();
            handleOffsetChange(offset - 0.5);
          } else {
            e.preventDefault();
            video.currentTime = Math.max(0, video.currentTime - 5);
            setShowPauseOverlay(false);
          }
          break;
        case 'ArrowRight':
          if (e.shiftKey && activeSubtitle) {
            e.preventDefault();
            handleOffsetChange(offset + 0.5);
          } else {
            e.preventDefault();
            video.currentTime = Math.min(duration, video.currentTime + 5);
            setShowPauseOverlay(false);
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          video.volume = Math.min(1, (video.volume || 0) + 0.1);
          setVolume(video.volume);
          setMuted(video.volume === 0);
          break;
        case 'ArrowDown':
          e.preventDefault();
          video.volume = Math.max(0, (video.volume || 0) - 0.1);
          setVolume(video.volume);
          setMuted(video.volume === 0);
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'Escape':
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            savePosition();
            onClose();
          }
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          toggleMute();
          break;
        default:
          if (e.key >= '0' && e.key <= '9' && duration) {
            e.preventDefault();
            video.currentTime = (parseInt(e.key) / 10) * duration;
            setShowPauseOverlay(false);
          }
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [duration, onClose, savePosition, toggleFullscreen, toggleMute, activeSubtitle, offset, handleOffsetChange]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      setResumeOverlay(null);
      setShowPauseOverlay(false);
      video.play();
    } else {
      video.pause();
    }
  }, []);

  const handleSeek = useCallback((e) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    video.currentTime = percent * duration;
    setCurrentTime(percent * duration);
    setShowPauseOverlay(false);
  }, [duration]);

  const handleSeekHover = useCallback((e) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setSeekHoverTime(percent * duration);
  }, [duration]);

  const handleSeekLeave = useCallback(() => {
    setSeekHoverTime(null);
  }, []);

  const handleVolumeChange = useCallback((e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) videoRef.current.volume = val;
    setMuted(val === 0);
  }, []);

  const skip = useCallback((seconds) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(duration, video.currentTime + seconds));
    setShowPauseOverlay(false);
  }, [duration]);

  const togglePiP = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch {}
  }, []);

  const changeSpeed = useCallback((s) => {
    setSpeed(s);
    if (videoRef.current) videoRef.current.playbackRate = s;
    setShowSpeedMenu(false);
  }, []);

  const handleResume = useCallback(() => {
    const video = videoRef.current;
    if (!video || !resumeOverlay) return;
    video.currentTime = resumeOverlay;
    setShowPauseOverlay(false);
    setResumeOverlay(null);
    video.play();
  }, [resumeOverlay]);

  const handleStartFromBeginning = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    setShowPauseOverlay(false);
    setResumeOverlay(null);
    video.play();
  }, []);

  const handleClose = useCallback(() => {
    savePosition();
    onClose();
  }, [onClose, savePosition]);

  const canPiP = typeof document !== 'undefined' && 'pictureInPictureEnabled' in document;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center ${fullscreen ? 'bg-black' : 'bg-black/60 backdrop-blur-sm'}`}
      onDoubleClick={toggleFullscreen}
      onClick={!fullscreen ? handleClose : undefined}
    >
      <div
        ref={containerRef}
        className={`relative w-full bg-black overflow-hidden animate-fade-in ${fullscreen ? '' : 'rounded-xl shadow-2xl'}`}
        onClick={(e) => e.stopPropagation()}
        style={{ aspectRatio: '16/9', maxWidth: fullscreen ? '100vw' : 'min(90vw, 1200px)', maxHeight: fullscreen ? '100vh' : '85vh' }}
      >
        <video
          ref={videoRef}
          className="w-full h-full"
          src={filePath}
          key={filePath}
          onClick={togglePlay}
          onDoubleClick={toggleFullscreen}
        />

        {/* Subtitle overlay */}
        {currentCues.length > 0 && activeSubtitle && (
          <div className="absolute bottom-[12%] left-0 right-0 pointer-events-none z-30 flex flex-col items-center">
            {currentCues.map((cue, i) => (
              <div
                key={i}
                className="text-white text-center px-3 py-1 mb-1 text-lg md:text-xl lg:text-2xl leading-relaxed"
                style={{
                  textShadow: '2px 2px 4px rgba(0,0,0,0.9), -2px -2px 4px rgba(0,0,0,0.9), 2px -2px 4px rgba(0,0,0,0.9), -2px 2px 4px rgba(0,0,0,0.9)',
                  maxWidth: '85%',
                  backgroundColor: 'rgba(0,0,0,0.35)',
                  borderRadius: '4px',
                }}
              >
                <span dangerouslySetInnerHTML={{ __html: cue.text.replace(/\n/g, '<br>') }} />
              </div>
            ))}
          </div>
        )}

        {resumeOverlay && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20">
            <div className="bg-surface rounded-xl p-xl shadow-xl border border-border text-center max-w-sm animate-slide-up">
              <p className="text-text-primary font-medium mb-sm">Resume playback?</p>
              <p className="text-text-muted text-sm mb-md">
                You were at {formatTime(resumeOverlay)}
              </p>
              <div className="flex gap-sm justify-center">
                <button
                  onClick={handleResume}
                  className="px-lg py-sm bg-accent text-background font-semibold rounded-button hover:bg-accent-hover transition-colors text-sm"
                >
                  Resume
                </button>
                <button
                  onClick={handleStartFromBeginning}
                  className="px-lg py-sm bg-surface-hover text-text-primary font-semibold rounded-button hover:bg-border transition-colors text-sm"
                >
                  Start Over
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 gap-md z-20">
            <p className="text-white text-lg">{error}</p>
            <button
              onClick={() => setShowErrorDetail(!showErrorDetail)}
              className="flex items-center gap-sm text-sm text-white/60 hover:text-white transition-colors"
            >
              {showErrorDetail ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Show Details
            </button>
            {showErrorDetail && errorDetail && (
              <div className="bg-black/80 rounded-lg p-md max-w-lg w-full mx-xl text-xs font-mono text-white/80 space-y-sm">
                <div><span className="text-white/50">Code: </span>{errorDetail.code}</div>
                {errorDetail.message && (
                  <div><span className="text-white/50">Message: </span>{errorDetail.message}</div>
                )}
                <div className="truncate"><span className="text-white/50">URL: </span>{errorDetail.filePath}</div>
                <button
                  onClick={() => navigator.clipboard.writeText(JSON.stringify(errorDetail, null, 2))}
                  className="flex items-center gap-sm text-accent hover:text-accent-hover transition-colors text-xs"
                >
                  <Copy className="w-3 h-3" />
                  Copy Error Details
                </button>
              </div>
            )}
          </div>
        )}

        {!playing && !error && !resumeOverlay && showPauseOverlay && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/30 transition-colors z-10"
          >
            <Play className="w-16 h-16 text-white/80" />
          </button>
        )}

        <div
          className={`absolute top-0 left-0 right-0 z-10 transition-opacity duration-300 ${
            controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="flex items-center justify-between px-lg py-sm bg-gradient-to-b from-black/80 to-transparent">
            <h3 className="text-sm font-medium text-white truncate flex-1">{title || 'Video Player'}</h3>
            <button onClick={handleClose} className="p-sm text-white/70 hover:text-white transition-colors" title="Close (Esc)">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div
          className={`absolute bottom-0 left-0 right-0 z-10 transition-opacity duration-300 ${
            controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="px-lg pb-sm bg-gradient-to-t from-black/80 to-transparent pt-xl">
            <div
              className="relative w-full h-1.5 bg-white/20 rounded-full cursor-pointer group mb-sm"
              onClick={handleSeek}
              onMouseMove={handleSeekHover}
              onMouseLeave={handleSeekLeave}
            >
              <div
                className="h-full bg-accent rounded-full relative transition-all"
                style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-accent rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" />
              </div>
              {seekHoverTime != null && (
                <div
                  className="absolute -top-7 -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-0.5 rounded pointer-events-none whitespace-nowrap"
                  style={{ left: `${(seekHoverTime / duration) * 100}%` }}
                >
                  {formatTime(seekHoverTime)}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-md min-w-0">
                <button onClick={() => skip(-10)} className="text-white/70 hover:text-white transition-colors shrink-0" title="Rewind 10s (←)">
                  <SkipBack className="w-5 h-5" />
                </button>
                <button onClick={togglePlay} className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors shrink-0" title="Play/Pause (Space)">
                  {playing ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white ml-0.5" />}
                </button>
                <button onClick={() => skip(10)} className="text-white/70 hover:text-white transition-colors shrink-0" title="Forward 10s (→)">
                  <SkipForward className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-sm group/vol shrink-0">
                  <button onClick={toggleMute} className="text-white/70 hover:text-white transition-colors" title="Mute (M)">
                    {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={muted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-16 md:w-20 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-accent opacity-0 group-hover/vol:opacity-100 transition-opacity"
                  />
                </div>
                <span className="text-xs text-white/60 font-mono shrink-0 hidden sm:inline">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              <div className="flex items-center gap-md shrink-0">
                <div className="relative">
                  <button
                    onClick={() => setShowSpeedMenu((p) => !p)}
                    onBlur={() => setTimeout(() => setShowSpeedMenu(false), 200)}
                    className="text-white/70 hover:text-white transition-colors text-xs px-2 py-0.5 rounded border border-white/20 hover:border-accent font-mono"
                    title="Playback speed"
                  >
                    {speed}x
                  </button>
                  {showSpeedMenu && (
                    <div className="absolute bottom-full right-0 mb-1 bg-surface border border-border rounded-lg p-xs shadow-xl whitespace-nowrap z-20">
                      {SPEEDS.map((s) => (
                        <button
                          key={s}
                          onMouseDown={(e) => { e.preventDefault(); changeSpeed(s); }}
                          className={`block w-full text-left px-sm py-xs text-xs rounded ${
                            speed === s ? 'text-accent' : 'text-text-muted hover:text-text-primary'
                          }`}
                        >
                          {s}x
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {allSubs.length > 0 && (
                  <div className="relative">
                    <button
                      onClick={() => setShowSubtitleMenu((p) => !p)}
                      className="text-white/70 hover:text-white transition-colors text-xs px-2 py-0.5 rounded border border-white/20 hover:border-accent"
                      title="Subtitles"
                    >
                      CC
                    </button>
                    {showSubtitleMenu && (
                      <div className="absolute bottom-full right-0 mb-1 z-20">
                        <div className="bg-surface border border-border rounded-lg p-xs shadow-xl whitespace-nowrap" onDoubleClick={(e) => e.stopPropagation()}>
                          <button
                            onMouseDown={(e) => { e.preventDefault(); setActiveSubtitle(null); setShowSubtitleMenu(false); }}
                            className={`block w-full text-left px-sm py-xs text-xs rounded ${
                              activeSubtitle === null ? 'text-accent' : 'text-text-muted hover:text-text-primary'
                            }`}
                          >
                            Off
                          </button>
                          {allSubs.map((s) => (
                            <div key={s.lang}>
                              <div className="flex items-center justify-between gap-2">
                                <button
                                  onMouseDown={(e) => { e.preventDefault(); setActiveSubtitle(s.lang); setShowSubtitleMenu(false); }}
                                  className={`flex-1 text-left px-sm py-xs text-xs rounded ${
                                    activeSubtitle === s.lang ? 'text-accent' : 'text-text-muted hover:text-text-primary'
                                  }`}
                                >
                                  {s.label || s.lang}
                                </button>
                                {s.lang !== 'custom' && (
                                  <button
                                    onMouseDown={(e) => { e.preventDefault(); handleDeleteSubtitle(s); }}
                                    className="p-1 text-text-muted hover:text-danger transition-colors"
                                    title="Delete subtitle"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                              {activeSubtitle === s.lang && (
                                <div className="flex items-center gap-1 px-sm py-1">
                                  <button
                                    onMouseDown={(e) => { e.preventDefault(); handleOffsetChange((subtitleOffset[s.lang] || 0) - 0.5); }}
                                    onMouseUp={stopLongPress}
                                    onMouseLeave={stopLongPress}
                                    onMouseEnter={() => {}}
                                    className="text-text-muted hover:text-text-primary transition-colors"
                                  >
                                    <ChevronLeft className="w-3.5 h-3.5" />
                                  </button>
                                  <input
                                    type="text"
                                    value={editingOffset != null ? editingOffset : (subtitleOffset[s.lang] || 0)}
                                    onFocus={(e) => setEditingOffset(e.target.value)}
                                    onChange={(e) => setEditingOffset(e.target.value)}
                                    onBlur={() => {
                                      const parsed = parseFloat(editingOffset);
                                      if (!isNaN(parsed)) handleOffsetChange(parsed);
                                      setEditingOffset(null);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.target.blur();
                                      }
                                    }}
                                    className="w-14 text-center bg-transparent text-text-primary text-xs font-mono border-b border-border focus:border-accent outline-none"
                                  />
                                  <button
                                    onMouseDown={(e) => { e.preventDefault(); handleOffsetChange((subtitleOffset[s.lang] || 0) + 0.5); }}
                                    onMouseUp={stopLongPress}
                                    onMouseLeave={stopLongPress}
                                    onMouseEnter={() => {}}
                                    className="text-text-muted hover:text-text-primary transition-colors"
                                  >
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  </button>
                                  <div className="relative group/info">
                                    <Info className="w-3 h-3 text-text-muted cursor-help" />
                                    <div className="absolute bottom-full right-0 mb-1 hidden group-hover/info:block z-30">
                                      <div className="bg-surface border border-border rounded-lg p-md shadow-xl w-72 text-xs text-text-muted leading-relaxed">
                                        Adjust subtitle timing to match audio/video.
                                        <br /><br />
                                        <strong className="text-text-primary">Positive (+):</strong> advance subtitles (appear earlier)
                                        <br />
                                        <strong className="text-text-primary">Negative (-):</strong> delay subtitles (appear later)
                                        <br /><br />
                                        <span className="text-text-primary">Keyboard:</span> <strong className="text-accent">Shift+←/→</strong> to adjust
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                          <div className="border-t border-border mt-1 pt-1">
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept=".vtt,.srt"
                              className="hidden"
                              onChange={handleUpload}
                            />
                            <button
                              onMouseDown={(e) => { e.preventDefault(); fileInputRef.current?.click(); }}
                              className="block w-full text-left px-sm py-xs text-xs rounded text-text-muted hover:text-text-primary hover:bg-surface-hover flex items-center gap-1"
                            >
                              <Upload className="w-3 h-3" />
                              Upload
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {canPiP && (
                  <button onClick={togglePiP} className="text-white/70 hover:text-white transition-colors" title="Picture-in-Picture">
                    <PictureInPicture2 className="w-5 h-5" />
                  </button>
                )}

                <button onClick={toggleFullscreen} className="text-white/70 hover:text-white transition-colors" title="Fullscreen (F)">
                  {fullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
