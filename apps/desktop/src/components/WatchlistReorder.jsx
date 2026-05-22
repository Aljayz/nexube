import { useState, useRef } from 'react';
import { GripVertical, Star, Clapperboard } from 'lucide-react';

function WatchlistReorder({ items, onSelect, onReorder }) {
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const dragItem = useRef(null);
  const dragNode = useRef(null);

  const handleDragStart = (index) => {
    dragItem.current = index;
    dragNode.current = event.target;
    setDragIndex(index);

    dragNode.current.addEventListener('dragend', handleDragEnd);
  };

  const handleDragEnter = (index) => {
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    if (dragItem.current === null || dragOverIndex === null) return;

    const newItems = [...items];
    const draggedItem = newItems.splice(dragItem.current, 1)[0];
    newItems.splice(dragOverIndex, 0, draggedItem);

    onReorder(newItems);
    setDragIndex(null);
    setDragOverIndex(null);
    dragItem.current = null;
    dragNode.current = null;
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  if (!items || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-text-muted">
        <Clapperboard className="w-12 h-12 mb-md" />
        <p className="text-lg">Your watchlist is empty</p>
        <p className="text-sm mt-sm">Add movies and shows to start organizing</p>
      </div>
    );
  }

  return (
    <div className="space-y-sm">
      {items.map((item, index) => (
        <div
          key={item.id}
          draggable
          onDragStart={() => handleDragStart(index)}
          onDragEnter={() => handleDragEnter(index)}
          onDragOver={handleDragOver}
          className={`flex items-center gap-md p-md bg-surface rounded-card border transition-all cursor-grab active:cursor-grabbing ${
            dragIndex === index
              ? 'opacity-50 border-accent'
              : dragOverIndex === index
              ? 'border-accent border-dashed'
              : 'border-border hover:border-border-hover'
          }`}
        >
          <div className="text-text-muted select-none">
            <GripVertical className="w-4 h-4" />
          </div>

          <div
            className="w-12 h-16 rounded overflow-hidden flex-shrink-0 cursor-pointer"
            onClick={() => onSelect(item)}
          >
            <img
              src={
                item.posterPath
                  ? `https://image.tmdb.org/t/p/w92${item.posterPath}`
                  : 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="72" fill="%2312121A"></svg>'
              }
              alt={item.title}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex-1 min-w-0">
            <h4
              className="text-sm font-medium text-text-primary truncate cursor-pointer hover:text-accent transition-colors"
              onClick={() => onSelect(item)}
            >
              {item.title}
            </h4>
            <p className="text-xs text-text-muted">
              {item.type === 'movie' ? 'Movie' : 'TV Show'}
              {item.releaseDate && ` • ${new Date(item.releaseDate).getFullYear()}`}
            </p>
          </div>

          <div className="flex items-center gap-sm">
            {item.voteAverage > 0 && (
              <span className="flex items-center gap-2xs text-xs text-success">
                <Star className="w-3 h-3 fill-current" />
                {item.voteAverage.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default WatchlistReorder;
