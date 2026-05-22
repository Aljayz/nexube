import { useState } from 'react';
import { X, AlertTriangle, Check } from 'lucide-react';

function NoticeDialog({ onClose, onDontShowAgain }) {
  const [dontShow, setDontShow] = useState(false);

  const handleClose = () => {
    if (dontShow) {
      onDontShowAgain?.();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-overlay backdrop-blur-overlay z-50 flex items-center justify-center p-xl">
      <div className="relative w-full max-w-md bg-surface rounded-xl overflow-hidden shadow-xl border border-border">
        <div className="flex items-center justify-between px-lg py-md border-b border-border">
          <div className="flex items-center gap-sm">
            <AlertTriangle className="w-5 h-5 text-warning" />
            <h3 className="text-lg font-bold text-text-primary">Notice</h3>
          </div>
          <button
            onClick={handleClose}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-lg">
          <p className="text-sm text-text-muted leading-relaxed mb-md">
            Some movies or TV series may not work perfectly due to source limitations. 
            If a title doesn't play, try switching to a different streaming source using the source selector in the player.
          </p>

          <label className="flex items-center gap-sm cursor-pointer text-sm text-text-muted hover:text-text-primary transition-colors">
            <div className="relative">
              <input
                type="checkbox"
                checked={dontShow}
                onChange={(e) => setDontShow(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-4 h-4 rounded border transition-colors ${dontShow ? 'bg-accent border-accent' : 'border-border'}`}>
                {dontShow && <Check className="w-4 h-4 text-background" />}
              </div>
            </div>
            Don't show this again
          </label>
        </div>

        <div className="px-lg py-md border-t border-border">
          <button onClick={handleClose} className="btn-primary w-full">
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

export default NoticeDialog;
