import { useState, useEffect } from 'react';
import { Minus, Square, X, Minimize2 } from 'lucide-react';

function CustomTitlebar() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (window.electron?.window?.onMaximizeChange) {
      window.electron.window.onMaximizeChange(setIsMaximized);
    }
  }, []);

  const handleMinimize = () => window.electron?.window?.minimize();
  const handleMaximize = () => window.electron?.window?.toggleMaximize();
  const handleClose = () => window.electron?.window?.close();

  return (
    <div
      className="flex items-center justify-between h-8 bg-background select-none relative z-[60]"
      style={{ WebkitAppRegion: 'drag' }}
    >
      <div className="flex items-center gap-sm px-md">
        {/* <img src="/Logo.png" alt="Nexube" className="w-4 h-4" /> */}
        <img src="Name.png" alt="Name" className="w-8 h-3" />
        {/* <span className="text-xs text-text-muted">Nexube</span> */}
      </div>

      <div
        className="flex items-center h-full"
        style={{ WebkitAppRegion: 'no-drag' }}
      >
        <button
          onClick={handleMinimize}
          className="titlebar-btn"
          aria-label="Minimize"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleMaximize}
          className="titlebar-btn"
          aria-label={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={handleClose}
          className="titlebar-btn close"
          aria-label="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default CustomTitlebar;
