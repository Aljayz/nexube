import { useState, useEffect } from 'react';
import { Plus, Lock } from 'lucide-react';
import AvatarPicker from './AvatarPicker';

export default function ProfileSelectScreen({
  showAddForm,
  onAddFormShown,
  onSelectProfile,
  onRequestMasterAuth,
}) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddFormVisible, setShowAddFormVisible] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileIsKids, setNewProfileIsKids] = useState(false);
  const [newProfilePin, setNewProfilePin] = useState('');
  const [newProfileAvatar, setNewProfileAvatar] = useState(null);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  useEffect(() => {
    loadProfiles();
  }, []);

  useEffect(() => {
    if (showAddForm) {
      handleAddProfileClick();
      onAddFormShown();
    }
  }, [showAddForm]);

  async function loadProfiles() {
    try {
      setLoading(true);
      const list = await window.electron?.profiles?.listProfiles();
      if (list) setProfiles(list);
    } catch (err) {
      console.error('Failed to load profiles:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddProfileClick() {
    const masterProfile = profiles.find((p) => p.isMaster);
    if (masterProfile?.securityType) {
      onRequestMasterAuth({ type: 'profile-create', profile: masterProfile });
    } else {
      setShowAddFormVisible(true);
    }
  }

  async function handleCreateProfile() {
    setProfileError('');
    setProfileSuccess('');

    if (!newProfileName.trim()) {
      setProfileError('Profile name is required');
      return;
    }

    if (newProfileName.trim().length > 20) {
      setProfileError('Profile name must be 20 characters or less');
      return;
    }

    if (newProfilePin && newProfilePin.length !== 4) {
      setProfileError('PIN must be 4 digits');
      return;
    }

    try {
      const profile = await window.electron?.profiles?.createProfile({
        name: newProfileName.trim(),
        isKids: newProfileIsKids,
        pinHash: newProfilePin || null,
        avatar: newProfileAvatar || null,
      });

      if (profile) {
        setProfiles((prev) => [...prev, profile]);
        setNewProfileName('');
        setNewProfileIsKids(false);
        setNewProfilePin('');
        setNewProfileAvatar(null);
        setShowAddFormVisible(false);
        setProfileSuccess('Profile created! Select it to sign in.');
        setTimeout(() => setProfileSuccess(''), 3000);
      }
    } catch (err) {
      setProfileError(err.message || 'Failed to create profile');
    }
  }

  function getAvatarSrc(avatar) {
    if (!avatar) return null;
    if (avatar.startsWith('file:')) return avatar;
    return avatar;
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background">
        <img src="Name.png" alt="Nexube" className="w-auto h-7 mb-xl opacity-50" />
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-background px-lg">
      <img src="Name.png" alt="Nexube" className="w-auto h-7 mb-xl" />

      <h1 className="text-2xl font-bold text-text-primary mb-lg">
        Who's watching?
      </h1>

      <div className="flex flex-wrap justify-center gap-lg mb-xl">
        {profiles.map((profile) => (
          <button
            key={profile.id}
            onClick={() => onSelectProfile(profile)}
            className="flex flex-col items-center gap-sm group w-32"
          >
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold text-background overflow-hidden transition-transform group-hover:scale-105 group-hover:ring-2 group-hover:ring-accent"
              style={{ backgroundColor: profile.avatarColor || '#00E5FF' }}
            >
              {profile.avatar ? (
                <img
                  src={getAvatarSrc(profile.avatar)}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                profile.name.charAt(0).toUpperCase()
              )}
            </div>
            <span className="text-sm text-text-muted group-hover:text-text-primary transition-colors text-center truncate w-full">
              {profile.name}
              {profile.isKids && (
                <span className="block text-xs text-accent">Kids</span>
              )}
            </span>
            {profile.securityType && (
              <Lock className="w-3 h-3 text-text-muted" />
            )}
          </button>
        ))}

        <button
          onClick={handleAddProfileClick}
          className="flex flex-col items-center gap-sm group w-32"
        >
          <div className="w-24 h-24 rounded-full flex items-center justify-center bg-surface border-2 border-dashed border-border group-hover:border-accent group-hover:bg-accent/5 transition-colors">
            <Plus className="w-10 h-10 text-text-muted group-hover:text-accent transition-colors" />
          </div>
          <span className="text-sm text-text-muted group-hover:text-text-primary transition-colors">
            Add Profile
          </span>
        </button>
      </div>

      {profileError && (
        <p className="text-danger text-sm mb-md">{profileError}</p>
      )}
      {profileSuccess && (
        <p className="text-success text-sm mb-md">{profileSuccess}</p>
      )}

      {showAddFormVisible && (
        <div className="bg-surface rounded-xl p-lg w-full max-w-sm border border-border overflow-y-auto max-h-[80vh]">
          <h2 className="text-lg font-bold text-text-primary mb-md">New Profile</h2>
          <div className="space-y-md">
            <input
              type="text"
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              placeholder="Profile name"
              className="input-field"
              autoFocus
            />
            <label className="flex items-center gap-sm text-sm text-text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={newProfileIsKids}
                onChange={(e) => setNewProfileIsKids(e.target.checked)}
                className="w-4 h-4 accent-accent"
              />
              Kids profile (content filtering enabled)
            </label>

            <div className="bg-background rounded-lg p-md border border-border">
              <AvatarPicker
                currentAvatar={newProfileAvatar}
                currentColor="#00E5FF"
                profileName={newProfileName || 'New Profile'}
                onSelect={setNewProfileAvatar}
              />
            </div>

            <input
              type="password"
              value={newProfilePin}
              onChange={(e) => setNewProfilePin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="PIN (optional, 4 digits)"
              maxLength={4}
              className="input-field"
            />
            <div className="flex gap-md">
              <button onClick={handleCreateProfile} className="btn-primary flex-1">
                Create
              </button>
              <button
                onClick={() => {
                  setShowAddFormVisible(false);
                  setNewProfileName('');
                  setNewProfileIsKids(false);
                  setNewProfilePin('');
                  setNewProfileAvatar(null);
                  setProfileError('');
                }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
