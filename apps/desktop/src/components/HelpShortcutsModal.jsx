import { X, HelpCircle, Keyboard, AlertTriangle, Bell, ThumbsUp } from 'lucide-react';

function HelpShortcutsModal({ onClose }) {
  const shortcuts = [
    { keys: ['Ctrl', 'F'], description: 'Open search' },
    { keys: ['Ctrl', 'Z'], description: 'Go back' },
    { keys: ['Ctrl', 'E'], description: 'Refresh player' },
    { keys: ['Ctrl', 'R'], description: 'Reload page' },
    { keys: ['Ctrl', 'X'], description: 'Logout / Switch profile' },
    { keys: ['Esc'], description: 'Close modal / Exit player' },
    { keys: ['Shift', 'Scroll'], description: 'Scroll carousel horizontally' },
  ];

  const playerShortcuts = [
    { keys: ['Space'], description: 'Play / Pause' },
    { keys: ['←', '→'], description: 'Seek backward / forward' },
    { keys: ['M'], description: 'Mute / Unmute' },
    { keys: ['F'], description: 'Toggle fullscreen' },
  ];

  return (
    <div className="fixed inset-0 bg-overlay backdrop-blur-overlay z-50 flex items-center justify-center p-xl" onClick={onClose}>
      <div className="relative w-full max-w-lg bg-surface rounded-xl overflow-hidden shadow-xl border border-border" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-lg py-md border-b border-border">
          <div className="flex items-center gap-sm">
            <HelpCircle className="w-5 h-5 text-accent" />
            <h3 className="text-lg font-bold text-text-primary">Help & Shortcuts</h3>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-lg space-y-lg overflow-y-auto max-h-[70vh]">
          <div>
            <div className="flex items-center gap-sm mb-sm">
              <Keyboard className="w-4 h-4 text-accent" />
              <h4 className="text-sm font-semibold text-text-primary">General Shortcuts</h4>
            </div>
            <div className="space-y-sm">
              {shortcuts.map((shortcut, index) => (
                <div key={index} className="flex items-center justify-between py-xs">
                  <span className="text-sm text-text-muted">{shortcut.description}</span>
                  <div className="flex gap-xs">
                    {shortcut.keys.map((key, i) => (
                      <kbd
                        key={i}
                        className="px-sm py-2xs bg-background border border-border rounded text-xs text-text-primary font-mono"
                      >
                        {key}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-border pt-lg">
            <div className="flex items-center gap-sm mb-sm">
              <Keyboard className="w-4 h-4 text-accent" />
              <h4 className="text-sm font-semibold text-text-primary">Player Shortcuts</h4>
            </div>
            <div className="space-y-sm">
              {playerShortcuts.map((shortcut, index) => (
                <div key={index} className="flex items-center justify-between py-xs">
                  <span className="text-sm text-text-muted">{shortcut.description}</span>
                  <div className="flex gap-xs">
                    {shortcut.keys.map((key, i) => (
                      <kbd
                        key={i}
                        className="px-sm py-2xs bg-background border border-border rounded text-xs text-text-primary font-mono"
                      >
                        {key}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-border pt-lg">
            <div className="flex items-center gap-sm mb-sm">
              <AlertTriangle className="w-4 h-4 text-warning" />
              <h4 className="text-sm font-semibold text-text-primary">Known Issues</h4>
            </div>
            <p className="text-sm text-text-muted leading-relaxed">
              Some movies or TV series may not work perfectly due to streaming source limitations. 
              If a title doesn't play, try switching to a different source using the source selector in the player.
            </p>
          </div>

          <div className="border-t border-border pt-lg">
            <div className="flex items-center gap-sm mb-sm">
              <Bell className="w-4 h-4 text-accent" />
              <h4 className="text-sm font-semibold text-text-primary">Notifications</h4>
            </div>
            <p className="text-sm text-text-muted leading-relaxed">
              When you favorite a movie or TV show, the app periodically checks for updates such as new seasons, 
              new episodes, or status changes. If something new is found, a notification badge appears in the 
              navigation bar. Open the Notifications page to see details and jump directly to the updated title.
            </p>
          </div>

          <div className="border-t border-border pt-lg">
            <div className="flex items-center gap-sm mb-sm">
              <ThumbsUp className="w-4 h-4 text-accent" />
              <h4 className="text-sm font-semibold text-text-primary">Similar Section</h4>
            </div>
            <p className="text-sm text-text-muted leading-relaxed">
              The home page shows a "Similar to ..." section based on your most recently favorited 
              movie or TV show. It uses TMDB's recommendation engine to find related content, helping 
              you discover new titles similar to what you already enjoy. This section only appears when 
              you have at least one item in your favorites.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HelpShortcutsModal;
