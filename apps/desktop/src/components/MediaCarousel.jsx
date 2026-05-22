import { useRef } from 'react';
import MediaCard from './MediaCard';

function MediaCarousel({ title, items, onSelect, showProgress = false, getProgress }) {
  const scrollRef = useRef(null);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.8;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="mb-xl overflow-y-visible">
      <div className="flex items-center justify-between mb-xl px-lg">
        <h2 className="text-xl font-bold text-text-primary">{title}</h2>
        <div className="flex gap-xs">
          <button
            onClick={() => scroll('left')}
            className="w-8 h-8 rounded-full bg-surface hover:bg-surface-hover text-text-muted hover:text-text-primary flex items-center justify-center transition-colors"
          >
            ‹
          </button>
          <button
            onClick={() => scroll('right')}
            className="w-8 h-8 rounded-full bg-surface hover:bg-surface-hover text-text-muted hover:text-text-primary flex items-center justify-center transition-colors"
          >
            ›
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="carousel-row px-lg"
      >
        {items.map((item) => (
          <MediaCard
            key={item.id}
            media={item}
            onClick={onSelect}
            showProgress={showProgress}
            progress={getProgress?.(item.id) || 0}
          />
        ))}
      </div>
    </div>
  );
}

export default MediaCarousel;
