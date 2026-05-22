import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

function TrailerModal({ videoKey, onClose }) {
  const iframeRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!videoKey) return null;

  return (
    <div className="fixed inset-0 bg-overlay backdrop-blur-overlay z-50 flex items-center justify-center p-xl">
      <div className="relative w-full max-w-4xl bg-surface rounded-xl overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-md py-sm bg-background border-b border-border">
          <h3 className="text-sm font-medium text-text-primary">Trailer</h3>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="aspect-video">
          <iframe
            ref={iframeRef}
            src={`https://www.youtube.com/embed/${videoKey}?autoplay=1&rel=0`}
            title="Trailer"
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}

export default TrailerModal;
