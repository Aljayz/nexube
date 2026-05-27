import { useState } from 'react';
import { Check } from 'lucide-react';

export default function PlaybackSettings({ activeProfile, onProfileUpdated }) {
  const [preferredSource, setPreferredSource] = useState(activeProfile?.preferredSource || 'videasy');
  const [autoMarkThreshold, setAutoMarkThreshold] = useState(activeProfile?.autoMarkThreshold || 20);
  const [saveStatus, setSaveStatus] = useState({});

  const handleSavePreferredSource = async (source) => {
    setPreferredSource(source);
    try {
      await window.electron?.profiles?.updateProfile(activeProfile.id, { preferredSource: source });
      if (onProfileUpdated) onProfileUpdated();
      setSaveStatus((prev) => ({ ...prev, source: 'saved' }));
      setTimeout(() => setSaveStatus((prev) => ({ ...prev, source: null })), 2000);
    } catch (err) {
      setSaveStatus((prev) => ({ ...prev, source: 'error' }));
    }
  };

  const handleSaveAutoMark = async () => {
    try {
      if (autoMarkThreshold < 5 || autoMarkThreshold > 120) {
        throw new Error('Threshold must be between 5 and 120 seconds');
      }
      await window.electron?.profiles?.updateProfile(activeProfile.id, { autoMarkThreshold });
      if (onProfileUpdated) onProfileUpdated();
      setSaveStatus((prev) => ({ ...prev, autoMark: 'saved' }));
      setTimeout(() => setSaveStatus((prev) => ({ ...prev, autoMark: null })), 2000);
    } catch (err) {
      setSaveStatus((prev) => ({ ...prev, autoMark: 'error' }));
    }
  };

  return (
    <div className="space-y-lg">
      <div className="bg-surface rounded-card p-lg border border-border">
        <h2 className="text-lg font-bold text-text-primary mb-md">Preferred Streaming Source</h2>
        <p className="text-sm text-text-muted mb-md">
          Select your default streaming source. Anime content will automatically use AllManga.
        </p>
        <div className="flex flex-wrap gap-sm">
          {['videasy', 'vidapi', 'vidsrc', 'allmanga'].map((source) => (
            <button
              key={source}
              onClick={() => handleSavePreferredSource(source)}
              className={`px-md py-sm rounded-button text-sm transition-colors ${
                preferredSource === source
                  ? 'bg-accent text-background'
                  : 'bg-surface-hover text-text-muted hover:text-text-primary'
              }`}
            >
              {source.charAt(0).toUpperCase() + source.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-surface rounded-card p-lg border border-border">
        <h2 className="text-lg font-bold text-text-primary mb-md">Auto-Mark Watched</h2>
        <p className="text-sm text-text-muted mb-md">
          Automatically mark content as watched when this many seconds remain.
        </p>
        <div className="flex items-center gap-md">
          <input
            type="number"
            value={autoMarkThreshold}
            onChange={(e) => setAutoMarkThreshold(Number(e.target.value))}
            className="input-field w-24"
            min={5}
            max={120}
          />
          <span className="text-sm text-text-muted">seconds</span>
          <button onClick={handleSaveAutoMark} className="btn-primary">
            {saveStatus.autoMark === 'saved' ? (
              <span className="flex items-center gap-sm">
                <Check className="w-4 h-4" />
                Saved
              </span>
            ) : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
