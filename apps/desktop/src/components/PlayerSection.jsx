import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, X, Shield, ExternalLink, Download, Maximize } from 'lucide-react';
import { PLAYER_SOURCES } from '@nexube/player-engine';
import { useBlockedStats } from '../hooks/useBlockedStats';
import BlockedStatsModal from './BlockedStatsModal';
import SkipButton from './SkipButton';

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function PlayerSection({
  details,
  mediaType,
  currentEpisode,
  selectedSeason,
  seasons,
  episodes,
  selectedSource,
  playerUrl,
  playerLoading,
  liveProgress,
  savedProgress,
  resolveError,
  dubMode,
  pipActive,
  webviewRef,
  dropdownRef,
  sourceDropdownRef,
  showEpisodeDropdown,
  showSourceDropdown,
  onToggleEpisodeDropdown,
  onToggleSourceDropdown,
  onSeasonChange,
  onEpisodeSelect,
  onSourceSelect,
  onDubModeToggle,
  onPopout,
  onStopPip,
  onPrevEpisode,
  onNextEpisode,
  onClose,
  onDownload,
}) {
  const displayProgress = liveProgress || savedProgress;
  const { sessionTotal, alltimeTotal, showModal, setShowModal, getSessionDomains } = useBlockedStats(playerUrl);
  const hasPlayed = liveProgress && (liveProgress.currentTime > 0 || !liveProgress.paused || liveProgress.duration > 0);
  const [showPlayWarning, setShowPlayWarning] = useState(false);
  const [playerFullscreen, setPlayerFullscreen] = useState(false);
  const playerSectionRef = useRef(null);

  // Intercept fullscreen requests from embedded players (vidsrc / vidapi use
  // the native Fullscreen API which would otherwise fullscreen the entire app).
  // Videasy and AllManga handle fullscreen internally, skip those.
  useEffect(() => {
    if (!selectedSource || selectedSource.progressMethod !== 'frameIteration') return;
    const enterH = window.electron?.player?.onWebviewEnterFullscreen?.(() => {
      setPlayerFullscreen(true);
      document.documentElement.setAttribute('data-player-fullscreen', '1');
      if (document.fullscreenElement) document.exitFullscreen?.();
    });
    const leaveH = window.electron?.player?.onWebviewLeaveFullscreen?.(() => {
      setPlayerFullscreen(false);
      document.documentElement.removeAttribute('data-player-fullscreen');
    });
    return () => {
      if (enterH) window.electron?.player?.offWebviewEnterFullscreen?.(enterH);
      if (leaveH) window.electron?.player?.offWebviewLeaveFullscreen?.(leaveH);
      document.documentElement.removeAttribute('data-player-fullscreen');
    };
  }, [selectedSource]);

  const handleFullscreen = () => {
    window.electron?.player?.popoutFullscreen?.(playerUrl);
  };

  useEffect(() => {
    const handler = () => {
      window.electron?.window?.setFullScreen?.(false);
    };
    window.electron?.player?.onFullscreenExit?.(handler);
    return () => window.electron?.player?.offFullscreenExit?.(handler);
  }, []);

  const handleDownloadClick = () => {
    if (!hasPlayed) {
      setShowPlayWarning(true);
      setTimeout(() => setShowPlayWarning(false), 3000);
      return;
    }
    onDownload?.();
  };

  if (!playerUrl) return null;

  return (
    <div ref={playerSectionRef} className="mt-xl" data-player-fullscreen-container>
      <div className={`rounded-card overflow-hidden border border-border bg-surface ${playerFullscreen ? 'h-full flex flex-col' : ''}`}>
        <div className={`flex items-center justify-between px-lg py-sm border-b border-border ${playerFullscreen ? 'hidden' : ''}`}>
          <button
            onClick={onClose}
            className="flex items-center gap-sm px-md py-sm bg-surface-hover hover:bg-border rounded-button text-text-primary transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          {selectedSource?.id !== 'allmanga' && (
            <div className="relative">
              <button
                onClick={handleDownloadClick}
                className={`p-sm transition-colors ${hasPlayed ? 'text-accent hover:text-accent/80' : 'text-text-muted hover:text-text-primary'}`}
                title={hasPlayed ? 'Download video' : 'Play the video first to download'}
              >
                <Download className="w-5 h-5" />
              </button>
              {showPlayWarning && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-3 py-1.5 bg-red-600 text-white text-xs rounded whitespace-nowrap shadow-lg z-50">
                  Play the video first before downloading
                </div>
              )}
            </div>
          )}
          <h2 className="text-sm font-medium text-text-primary truncate flex-1 text-center">
            {details?.title}
            {currentEpisode && (
              <span className="text-text-muted ml-sm">
                S{selectedSeason} E{currentEpisode.episode_number} - {currentEpisode.name}
              </span>
            )}
          </h2>
          {mediaType === 'tv' && (
            <div className="flex items-center gap-sm">
              <button
                onClick={onPrevEpisode}
                className="p-sm text-text-muted hover:text-text-primary transition-colors"
                disabled={!currentEpisode && selectedSeason === 1}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={onToggleEpisodeDropdown}
                  className="flex items-center gap-sm px-md py-sm bg-surface-hover hover:bg-border rounded-button text-text-primary transition-colors"
                >
                  <span className="text-sm">
                    {currentEpisode ? `E${currentEpisode.episode_number}` : `S${selectedSeason}`}
                  </span>
                  <ChevronDown className="w-4 h-4" />
                </button>
                {showEpisodeDropdown && (
                  <div className="absolute right-0 top-full mt-sm w-64 bg-surface border border-border rounded-lg shadow-lg overflow-hidden z-50 max-h-80 overflow-y-auto">
                    <div className="flex items-center justify-between px-md py-sm border-b border-border">
                      <button
                        onClick={() => selectedSeason > 1 && onSeasonChange(selectedSeason - 1)}
                        disabled={selectedSeason <= 1}
                        className="p-xs text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-sm font-medium text-text-primary">Season {selectedSeason}</span>
                      <button
                        onClick={() => selectedSeason < seasons.length && onSeasonChange(selectedSeason + 1)}
                        disabled={selectedSeason >= seasons.length}
                        className="p-xs text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                    {episodes.map((ep) => (
                      <button
                        key={ep.id}
                        onClick={() => {
                          onEpisodeSelect(ep);
                        }}
                        className={`w-full px-md py-sm text-left text-sm transition-colors ${
                          currentEpisode?.id === ep.id
                            ? 'bg-accent/10 text-accent'
                            : 'text-text-primary hover:bg-surface-hover'
                        }`}
                      >
                        E{ep.episode_number} - {ep.name.length > 30 ? ep.name.slice(0, 30) + '...' : ep.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={onNextEpisode}
                className="p-sm text-text-muted hover:text-text-primary transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
          <div className="relative" ref={sourceDropdownRef}>
            <button
              onClick={onToggleSourceDropdown}
              className="flex items-center gap-sm px-md py-sm bg-surface-hover hover:bg-border rounded-button text-text-primary transition-colors"
            >
              <span className="text-sm">{selectedSource?.label || 'Source'}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            {showSourceDropdown && (
              <div className="absolute right-0 top-full mt-sm w-48 bg-surface border border-border rounded-lg shadow-lg overflow-hidden z-50">
                {PLAYER_SOURCES.map((source) => (
                  <button
                    key={source.id}
                    onClick={() => onSourceSelect(source)}
                    className={`w-full px-md py-sm text-left text-sm transition-colors ${
                      selectedSource?.id === source.id
                        ? 'bg-accent/10 text-accent'
                        : 'text-text-primary hover:bg-surface-hover'
                    }`}
                  >
                    {source.label}
                    {source.tag && <span className="ml-xs text-xs opacity-70">{source.tag}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedSource?.id === 'allmanga' && (
            <button
              onClick={onDubModeToggle}
              className={`px-md py-sm rounded-button text-sm font-medium transition-colors ${
                dubMode === 'dub'
                  ? 'bg-accent text-background'
                  : 'bg-accent text-background'
              }`}
              title="Toggle between subbed and dubbed"
            >
              {dubMode === 'sub' ? 'SUB' : 'DUB'}
            </button>
          )}
          <button
            onClick={() => setShowModal(true)}
            className="p-sm text-text-muted hover:text-text-primary transition-colors relative"
            title="View blocked ads & trackers"
          >
            <Shield className="w-5 h-5" />
            {sessionTotal > 0 && (
              <span className="absolute -top-0.5 -right-0.5 text-xs bg-accent text-background rounded-full w-4 h-4 flex items-center justify-center font-medium">
                {sessionTotal > 99 ? '99+' : sessionTotal}
              </span>
            )}
          </button>
          {onPopout && (
            <button
              onClick={onPopout}
              className="p-sm text-text-muted hover:text-text-primary transition-colors"
              title="Pop-out player"
            >
              <ExternalLink className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={handleFullscreen}
            className="p-sm text-text-muted hover:text-text-primary transition-colors"
            title="Fullscreen"
          >
            <Maximize className="w-5 h-5" />
          </button>
          <button
            onClick={onClose}
            className="p-sm text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className={`relative bg-black ${playerFullscreen ? 'flex-1 max-h-[100dvh]' : 'aspect-video'}`}>
          {resolveError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
              <div className="text-center px-xl">
                <p className="text-red-400 font-medium mb-sm">Failed to load source</p>
                <p className="text-text-muted text-sm mb-md">{resolveError}</p>
                <p className="text-text-muted text-xs">Try switching to a different source or toggling SUB/DUB</p>
              </div>
            </div>
          )}
          {playerLoading && !resolveError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <SkipButton
            tmdbId={details?.tmdbId}
            episodeNumber={currentEpisode?.episode_number}
            currentTime={liveProgress?.currentTime || 0}
            onSkip={(endTime) => {
              const wv = webviewRef.current;
              if (wv) {
                wv.executeJavaScript(`document.querySelector('video').currentTime = ${endTime}`).catch(() => {});
              }
            }}
          />
          {pipActive && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
              <div className="text-center px-xl">
                <p className="text-text-primary font-medium mb-sm">Playing in Picture-in-Picture</p>
                <p className="text-text-muted text-sm mb-md">You can close the PiP window or stop it here</p>
                <button
                  onClick={onStopPip}
                  className="px-lg py-sm bg-accent text-background rounded-button text-sm font-medium hover:bg-accent/90 transition-colors"
                >
                  Stop PiP
                </button>
              </div>
            </div>
          )}
          <webview
            ref={webviewRef}
            src={playerUrl}
            key="player-webview"
            className={`w-full h-full ${pipActive ? 'opacity-0 pointer-events-none' : ''}`}
            partition="persist:player"
            allowFullScreen
            webpreferences="autoplayPolicy=no-user-gesture-required"
          />
        </div>
      </div>

      {showModal && (
        <BlockedStatsModal
          sessionDomains={getSessionDomains()}
          sessionTotal={sessionTotal}
          alltimeTotal={alltimeTotal}
          onClose={() => setShowModal(false)}
        />
      )}

      {displayProgress && (displayProgress.duration || displayProgress.progress_seconds || 0) > 0 && (
        <div className="mt-sm px-lg py-sm bg-surface rounded-card border border-border">
          <div className="flex items-center gap-md">
            <div className="flex-1">
              <div className="h-1.5 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(displayProgress.percent || displayProgress.progress_percent || 0, 100)}%` }}
                />
              </div>
            </div>
            <span className="text-xs text-text-muted whitespace-nowrap">
              {formatTime(displayProgress.currentTime || displayProgress.progress_seconds || 0)} / {formatDuration(displayProgress.duration || 0)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
