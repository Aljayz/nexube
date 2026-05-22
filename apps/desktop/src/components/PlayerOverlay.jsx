import { useState, useEffect, useRef, useCallback } from 'react';
import { InactivityDimmer } from '@nexube/player-engine';
import { Play, Pause, Volume2, VolumeX, ArrowLeft, Popout } from 'lucide-react';
import SkipButton from './SkipButton';

function PlayerOverlay({
  isPlaying,
  progress,
  duration,
  volume,
  onPlayPause,
  onSeek,
  onVolumeChange,
  onPopout,
  onClose,
  tmdbId,
  episodeNumber,
}) {
  const [controlsVisible, setControlsVisible] = useState(true);
  const dimmerRef = useRef(new InactivityDimmer(3000));
  const containerRef = useRef(null);

  useEffect(() => {
    const dimmer = dimmerRef.current;
    dimmer.setOnVisibilityChange(setControlsVisible);

    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = () => dimmer.recordActivity();
    const handleTouchStart = () => dimmer.recordActivity();

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('touchstart', handleTouchStart);

    dimmer.recordActivity();

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('touchstart', handleTouchStart);
      dimmer.destroy();
    };
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = useCallback(
    (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      onSeek(percent * duration);
    },
    [duration, onSeek]
  );

  const handleSkip = useCallback(
    (endTime) => {
      onSeek(endTime);
    },
    [onSeek]
  );

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 flex flex-col justify-between"
    >
      <div
        className={`bg-gradient-to-b from-black/60 to-transparent p-lg transition-opacity duration-300 ${
          controlsVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="flex items-center gap-sm text-white hover:text-accent transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <button
            onClick={onPopout}
            className="flex items-center gap-sm text-white hover:text-accent transition-colors text-sm"
          >
            <Popout className="w-4 h-4" />
            Pop-out
          </button>
        </div>
      </div>

      <div className="relative">
        <SkipButton
          tmdbId={tmdbId}
          episodeNumber={episodeNumber}
          currentTime={progress}
          onSkip={handleSkip}
        />
      </div>

      <div
        className={`bg-gradient-to-t from-black/80 to-transparent p-lg transition-opacity duration-300 ${
          controlsVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="mb-md">
          <div
            className="h-1 bg-white/20 rounded-full cursor-pointer group"
            onClick={handleSeek}
          >
            <div
              className="h-full bg-accent rounded-full relative transition-all"
              style={{ width: `${duration ? (progress / duration) * 100 : 0}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-accent rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
          <div className="flex items-center justify-between mt-sm text-xs text-white/70">
            <span>{formatTime(progress)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-md">
            <button
              onClick={onPlayPause}
              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
            >
              {isPlaying ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white ml-0.5" />}
            </button>

            <div className="flex items-center gap-sm group">
              <button
                onClick={() => onVolumeChange(volume === 0 ? 1 : 0)}
                className="text-white hover:text-accent transition-colors"
              >
                {volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className="w-20 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-accent opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlayerOverlay;
