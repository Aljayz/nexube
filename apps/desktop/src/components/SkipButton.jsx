import { useState, useEffect } from 'react';
import { fetchSkipTimes, getActiveSkipSegment } from '@nexube/player-engine';

function SkipButton({ tmdbId, episodeNumber, currentTime, onSkip }) {
  const [segments, setSegments] = useState([]);
  const [activeSegment, setActiveSegment] = useState(null);

  useEffect(() => {
    if (!tmdbId || !episodeNumber) return;

    async function loadSkipTimes() {
      const times = await fetchSkipTimes(tmdbId, episodeNumber);
      setSegments(times);
    }

    loadSkipTimes();
  }, [tmdbId, episodeNumber]);

  useEffect(() => {
    const segment = getActiveSkipSegment(segments, currentTime);
    setActiveSegment(segment);
  }, [currentTime, segments]);

  if (!activeSegment) return null;

  const timeRemaining = Math.round(activeSegment.interval.endTime - currentTime);

  return (
    <button
      onClick={() => onSkip(activeSegment.interval.endTime)}
      className="absolute bottom-24 right-8 px-lg py-sm bg-surface/90 hover:bg-accent text-text-primary hover:text-background rounded-button font-medium transition-all duration-200 flex items-center gap-sm shadow-lg backdrop-blur-sm"
    >
      <span>Skip {activeSegment.skipType}</span>
      <span className="text-sm opacity-70">{timeRemaining}s</span>
    </button>
  );
}

export default SkipButton;
