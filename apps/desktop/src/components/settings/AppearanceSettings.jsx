import { useState } from 'react';
import { Check } from 'lucide-react';

const PROFILE_COLORS = ['#00E5FF', '#2ED573', '#FFA502', '#FF4757', '#A855F7', '#EC4899', '#3B82F6', '#F59E0B'];

export default function AppearanceSettings({
  pendingAccentColor,
  setPendingAccentColor,
  onSaveAccentColor,
}) {
  const [saveStatus, setSaveStatus] = useState(null);

  const handleSave = async () => {
    try {
      await onSaveAccentColor(pendingAccentColor);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (err) {
      console.error('Failed to save accent color:', err);
      setSaveStatus('error');
    }
  };

  return (
    <div className="space-y-lg">
      <div className="bg-surface rounded-card p-lg border border-border">
        <h2 className="text-lg font-bold text-text-primary mb-md">Accent Color</h2>
        <p className="text-sm text-text-muted mb-md">
          Choose your preferred accent color for the application.
        </p>
        <div className="flex flex-wrap gap-sm mb-md">
          {PROFILE_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => setPendingAccentColor(color)}
              className={`w-10 h-10 rounded-full transition-all ${
                pendingAccentColor === color ? 'ring-2 ring-offset-2 ring-offset-surface' : ''
              }`}
              style={{
                backgroundColor: color,
                ringColor: color,
              }}
            >
              {pendingAccentColor === color && <Check className="w-5 h-5 mx-auto" style={{ color: color === '#F59E0B' || color === '#FFA502' ? '#000' : '#fff' }} />}
            </button>
          ))}
        </div>
        <button onClick={handleSave} className="btn-primary">
          {saveStatus === 'saved' ? (
            <span className="flex items-center gap-sm">
              <Check className="w-4 h-4" />
              Saved
            </span>
          ) : saveStatus === 'error' ? (
            'Failed'
          ) : 'Save'}
        </button>
      </div>
    </div>
  );
}
