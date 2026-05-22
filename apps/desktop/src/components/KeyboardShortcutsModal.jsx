import { X } from 'lucide-react';

function KeyboardShortcutsModal({ onClose }) {
  const shortcuts = [
    { keys: ['Ctrl', 'F'], description: 'Open search' },
    { keys: ['Ctrl', 'Z'], description: 'Go back' },
    { keys: ['Ctrl', 'E'], description: 'Refresh player' },
    { keys: ['Esc'], description: 'Close modal / Exit search' },
    { keys: ['Space'], description: 'Play / Pause (in player)' },
    { keys: ['←', '→'], description: 'Seek backward / forward (in player)' },
    { keys: ['M'], description: 'Mute / Unmute (in player)' },
    { keys: ['F'], description: 'Toggle fullscreen (in player)' },
    { keys: ['S'], description: 'Skip intro (in player)' },
  ];

  return (
    <div className="fixed inset-0 bg-overlay backdrop-blur-overlay z-50 flex items-center justify-center p-xl">
      <div className="relative w-full max-w-md bg-surface rounded-xl overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-lg py-md bg-background border-b border-border">
          <h3 className="text-lg font-bold text-text-primary">Keyboard Shortcuts</h3>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-lg">
          <div className="space-y-sm">
            {shortcuts.map((shortcut, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-sm"
              >
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
      </div>
    </div>
  );
}

export default KeyboardShortcutsModal;
