import { useState, useRef, useCallback, useEffect } from 'react';

const POLL_INTERVAL = 5000;

export function usePlayer(details, profileId, mediaId, selectedSource, selectedSeason, autoMarkThreshold = 20, dubMode = 'sub') {
  const [playerUrl, setPlayerUrl] = useState(null);
  const [playerLoading, setPlayerLoading] = useState(true);
  const [currentEpisode, setCurrentEpisode] = useState(null);
  const [liveProgress, setLiveProgress] = useState(null);
  const [resolveError, setResolveError] = useState(null);
  const webviewRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const historyAddedRef = useRef(false);

  const resolveUrlFromSource = useCallback(async (source, episode = null) => {
    if (!source) return null;

    if (source.async && source.id === 'allmanga') {
      setResolveError(null);
      try {
        const epNum = episode?.episode_number || 1;
        const result = await window.electron.resolveAllmanga({
          title: details?.title || '',
          seasonNumber: details?.type === 'tv' ? selectedSeason : undefined,
          episodeNumber: details?.type === 'tv' ? epNum : 1,
          isMovie: details?.type === 'movie',
          translationType: dubMode,
        });
        if (!result.ok) {
          setResolveError(result.error || 'Failed to resolve AllManga source');
          return null;
        }
        const videoResult = await window.electron.setPlayerVideo({
          url: result.url,
          referer: result.referer,
          startTime: 0,
        });
        return videoResult.playerUrl;
      } catch (err) {
        setResolveError(err.message);
        return null;
      }
    }

    if (source.async) {
      return await source.url(details?.type, details?.tmdbId);
    }

    if (episode && source.urlWithEpisode) {
      return source.urlWithEpisode(details?.type, details?.tmdbId, selectedSeason, episode.episode_number);
    }
    return source.url(details?.type, details?.tmdbId);
  }, [details, selectedSeason, dubMode]);

  const addToHistory = useCallback(() => {
    if (!details) return;
    const title = currentEpisode
      ? `${details.title} - S${selectedSeason}E${currentEpisode.episode_number}: ${currentEpisode.name}`
      : details.title;
    window.electron?.library?.history?.add(
      profileId,
      mediaId,
      title,
      details.posterPath,
      currentEpisode ? selectedSeason : null,
      currentEpisode ? currentEpisode.episode_number : null
    ).catch(() => {});
  }, [details, profileId, mediaId, currentEpisode, selectedSeason]);

  const saveProgressToDB = useCallback(async (progressData) => {
    if (!progressData || progressData.duration <= 0) return;
    const season = currentEpisode ? selectedSeason : null;
    const episode = currentEpisode ? currentEpisode.episode_number : null;
    await window.electron?.library?.progress?.update(profileId, mediaId, {
      progressPercent: progressData.percent,
      progressSeconds: progressData.currentTime,
      duration: progressData.duration,
      season,
      episode,
    });
  }, [profileId, mediaId, currentEpisode, selectedSeason]);

  const handlePlay = async (episode = null) => {
    if (!details) return;

    try {
      const url = await resolveUrlFromSource(selectedSource, episode);
      if (!url) return;

      setCurrentEpisode(episode || null);
      setPlayerLoading(true);
      setPlayerUrl(url);
      setLiveProgress(null);
      historyAddedRef.current = false;
    } catch (err) {
      console.error('Failed to start playback:', err);
      setPlayerLoading(false);
    }
  };

  const switchPlayerUrl = async (episode = null, sourceOverride = null) => {
    try {
      const source = sourceOverride || selectedSource;
      if (!source) return;
      const url = await resolveUrlFromSource(source, episode);
      if (!url) return;
      setCurrentEpisode(episode || null);
      setPlayerLoading(true);
      setPlayerUrl(url);
      setLiveProgress(null);
      historyAddedRef.current = false;
    } catch (err) {
      console.error('Failed to switch playback:', err);
      setPlayerLoading(false);
    }
  };

    const clearResolveError = useCallback(() => setResolveError(null), []);

  const handleClosePlayer = async () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (liveProgress && liveProgress.duration > 0) {
      await saveProgressToDB(liveProgress);
      if (liveProgress.duration - liveProgress.currentTime <= autoMarkThreshold) {
        addToHistory();
      }
    }
    window.electron?.player?.stop();
    setPlayerUrl(null);
    setPlayerLoading(true);
    setLiveProgress(null);
    setResolveError(null);
  };

  // Webview load events
  useEffect(() => {
    if (!playerUrl) return;
    const webview = webviewRef.current;
    if (!webview) return;

    let mounted = true;
    let timeoutId;

    const handleDidFinishLoad = () => {
      clearTimeout(timeoutId);
      if (mounted) setPlayerLoading(false);
    };

    const handleDidFailLoad = (e) => {
      clearTimeout(timeoutId);
      if (e.isMainFrame) {
        console.error('Webview failed to load:', e);
      }
      if (mounted) setPlayerLoading(false);
    };

    const handleNewWindow = (e) => {
      e.preventDefault();
      try {
        const popupUrl = e.url || '';
        if (popupUrl && window.electron?.recordBlockedPopup) {
          window.electron.recordBlockedPopup(popupUrl);
        }
      } catch {}
    };

    const handleWillNavigate = (e) => {
      try {
        const navUrl = e.url ? new URL(e.url) : null;
        const currentUrl = playerUrl ? new URL(playerUrl) : null;
        if (!navUrl || !currentUrl || navUrl.hostname !== currentUrl.hostname) {
          e.preventDefault();
          if (e.url && window.electron?.recordBlockedPopup) {
            window.electron.recordBlockedPopup(e.url);
          }
        }
      } catch {
        e.preventDefault();
      }
    };

    timeoutId = setTimeout(() => {
      if (mounted) setPlayerLoading(false);
    }, 15000);

    webview.addEventListener('did-finish-load', handleDidFinishLoad);
    webview.addEventListener('did-fail-load', handleDidFailLoad);
    webview.addEventListener('new-window', handleNewWindow);
    webview.addEventListener('will-navigate', handleWillNavigate);

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      webview.removeEventListener('did-finish-load', handleDidFinishLoad);
      webview.removeEventListener('did-fail-load', handleDidFailLoad);
      webview.removeEventListener('new-window', handleNewWindow);
      webview.removeEventListener('will-navigate', handleWillNavigate);
    };
  }, [playerUrl]);

  // Progress polling
  useEffect(() => {
    if (!playerUrl) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    let prevPaused = false;

    async function pollProgress() {
      const webview = webviewRef.current;
      if (!webview) return;

      try {
        const result = await webview.executeJavaScript(`
          (function() {
            const video = document.querySelector('video');
            if (!video || !video.duration) return null;
            return {
              currentTime: video.currentTime,
              duration: video.duration,
              percent: Math.round((video.currentTime / video.duration) * 100),
              paused: video.paused
            };
          })()
        `);

        if (result && result.duration > 0) {
          setLiveProgress(result);

          if (result.duration - result.currentTime <= autoMarkThreshold && !historyAddedRef.current) {
            historyAddedRef.current = true;
            addToHistory();
          }

          const justPaused = result.paused && !prevPaused;
          if (justPaused) {
            await saveProgressToDB(result);
          }
          prevPaused = result.paused;
        }
      } catch (err) {
        // Webview may not be ready or source doesn't expose video element
      }
    }

    pollIntervalRef.current = setInterval(pollProgress, POLL_INTERVAL);
    pollProgress();

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [playerUrl, profileId, mediaId, currentEpisode, selectedSeason, addToHistory, saveProgressToDB, autoMarkThreshold]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (playerUrl) {
        if (e.key === 'Escape' || ((e.metaKey || e.ctrlKey) && e.key === 'z')) {
          e.preventDefault();
          handleClosePlayer();
        }
        if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
          e.preventDefault();
          setPlayerLoading(true);
          if (webviewRef.current) {
            webviewRef.current.reload();
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playerUrl]);

  return {
    playerUrl,
    playerLoading,
    currentEpisode,
    liveProgress,
    resolveError,
    clearResolveError,
    webviewRef,
    handlePlay,
    switchPlayerUrl,
    handleClosePlayer,
  };
}
