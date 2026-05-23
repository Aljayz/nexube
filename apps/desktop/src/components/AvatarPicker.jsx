import { useState } from 'react';
import { Upload } from 'lucide-react';

const BUILT_IN_AVATARS = [
  'avatar1.png',
  'avatar2.png',
  'avatar3.png',
  'avatar4.png',
  'avatar5.png',
  'avatar6.png',
];

export default function AvatarPicker({ currentAvatar, currentColor, profileName, onSelect }) {
  const [customAvatar, setCustomAvatar] = useState(null);

  async function handleUpload() {
    const path = await window.electron?.profiles?.pickAvatar();
    if (path) {
      setCustomAvatar(path);
      onSelect(path);
    }
  }

  function handleBuiltIn(filename) {
    setCustomAvatar(null);
    onSelect(filename);
  }

  function getAvatarSrc(avatar) {
    if (!avatar) return null;
    if (avatar.startsWith('file:')) return avatar;
    return avatar;
  }

  return (
    <div className="space-y-md">
      <div className="flex items-center gap-md mb-md">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-background overflow-hidden shrink-0"
          style={{ backgroundColor: currentColor || '#00E5FF' }}
        >
          {currentAvatar || customAvatar ? (
            <img
              src={customAvatar || getAvatarSrc(currentAvatar)}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            profileName.charAt(0).toUpperCase()
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary">{profileName}</p>
          <p className="text-xs text-text-muted">Choose an avatar</p>
        </div>
      </div>

      <p className="text-xs text-text-muted font-medium uppercase tracking-wider">Built-in Avatars</p>
      <div className="flex flex-wrap gap-sm">
        {BUILT_IN_AVATARS.map((filename) => {
          const isSelected = currentAvatar === filename && !customAvatar;
          return (
            <button
              key={filename}
              onClick={() => handleBuiltIn(filename)}
              className={`w-14 h-14 rounded-full overflow-hidden border-2 transition-all ${
                isSelected
                  ? 'border-accent scale-110 ring-2 ring-accent/30'
                  : 'border-transparent hover:border-accent/50 hover:scale-105'
              }`}
            >
              <img src={filename} alt="" className="w-full h-full object-cover" />
            </button>
          );
        })}
      </div>

      <div className="border-t border-border pt-md">
        <button
          onClick={handleUpload}
          className="flex items-center gap-sm text-sm text-accent hover:text-accent-hover transition-colors"
        >
          <Upload className="w-4 h-4" />
          Upload custom avatar
        </button>
      </div>
    </div>
  );
}
