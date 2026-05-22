import { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Lock, Check, Clock, Search, Film, Tv, ExternalLink } from 'lucide-react';
import AvatarPicker from '../AvatarPicker';

function LoadingSkeleton() {
  return (
    <div className="space-y-md">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-md p-md bg-background rounded-lg animate-pulse">
          <div className="w-10 h-10 rounded-full bg-surface" />
          <div className="flex-1">
            <div className="h-4 bg-surface rounded w-1/3 mb-xs" />
            <div className="h-3 bg-surface rounded w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ProfilesSettings({
  profiles,
  profilesLoading,
  onAddProfile,
  onDeleteProfile,
  onSaved,
}) {
  const [showAddProfile, setShowAddProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileIsKids, setNewProfileIsKids] = useState(false);
  const [newProfilePin, setNewProfilePin] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  const [editingProfile, setEditingProfile] = useState(null);
  const [editAvatar, setEditAvatar] = useState(null);
  const [editEnableSecurity, setEditEnableSecurity] = useState(false);
  const [editSecurityType, setEditSecurityType] = useState('pin');
  const [editPinCode, setEditPinCode] = useState('');
  const [editConfirmPin, setEditConfirmPin] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editConfirmPassword, setEditConfirmPassword] = useState('');
  const [editShowPassword, setEditShowPassword] = useState(false);
  const [editShowConfirmPassword, setEditShowConfirmPassword] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  const [editTab, setEditTab] = useState('profile');
  const [searchHistory, setSearchHistory] = useState([]);
  const [watchHistory, setWatchHistory] = useState([]);
  const [watchHistoryLoading, setWatchHistoryLoading] = useState(false);

  useEffect(() => {
    if (editingProfile) {
      setEditAvatar(editingProfile.avatar || null);
      setEditEnableSecurity(!!editingProfile.securityType);
      setEditSecurityType(editingProfile.securityType || 'pin');
      setEditPinCode('');
      setEditConfirmPin('');
      setEditPassword('');
      setEditConfirmPassword('');
      setEditError('');
      setEditSuccess('');
      setEditTab('profile');

      try {
        const key = `searchHistory_${editingProfile.id}`;
        const raw = localStorage.getItem(key);
        setSearchHistory(raw ? JSON.parse(raw) : []);
      } catch {
        setSearchHistory([]);
      }

      setWatchHistoryLoading(true);
      window.electron?.library?.history?.list(editingProfile.id)
        .then((items) => setWatchHistory(items || []))
        .catch(() => setWatchHistory([]))
        .finally(() => setWatchHistoryLoading(false));
    }
  }, [editingProfile]);

  const handleAddProfile = async () => {
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
      const profile = await onAddProfile({
        name: newProfileName.trim(),
        isKids: newProfileIsKids,
        pinHash: newProfilePin || null,
      });

      if (profile) {
        setNewProfileName('');
        setNewProfileIsKids(false);
        setNewProfilePin('');
        setShowAddProfile(false);
        setProfileSuccess('Profile created successfully');
        setTimeout(() => setProfileSuccess(''), 3000);
      }
    } catch (err) {
      setProfileError(err.message || 'Failed to create profile');
    }
  };

  const handleDeleteProfile = async (id) => {
    setProfileError('');
    setProfileSuccess('');

    if (id === 'master-id' || id === 'kids-id') {
      setProfileError('Cannot delete default profiles');
      return;
    }

    if (confirm('Are you sure you want to delete this profile?')) {
      try {
        await onDeleteProfile(id);
        setProfileSuccess('Profile deleted');
        setTimeout(() => setProfileSuccess(''), 3000);
      } catch (err) {
        setProfileError(err.message || 'Failed to delete profile');
      }
    }
  };

  async function handleEditAvatar(newAvatar) {
    setEditAvatar(newAvatar);
    const updated = await window.electron?.profiles?.updateProfile(editingProfile.id, { avatar: newAvatar });
    if (updated) {
      setEditingProfile(updated);
      setEditSuccess('Avatar updated');
      setTimeout(() => setEditSuccess(''), 3000);
      if (onSaved) onSaved();
    }
  }

  async function handleEditSaveSecurity(e) {
    e.preventDefault();
    setEditError('');
    setEditSuccess('');

    if (editEnableSecurity) {
      if (editSecurityType === 'pin') {
        if (editPinCode.length !== 4 || !/^\d{4}$/.test(editPinCode)) {
          setEditError('PIN must be exactly 4 digits');
          return;
        }
        if (editPinCode !== editConfirmPin) {
          setEditError('PINs do not match');
          return;
        }
      } else {
        if (editPassword.length < 4) {
          setEditError('Password must be at least 4 characters');
          return;
        }
        if (editPassword !== editConfirmPassword) {
          setEditError('Passwords do not match');
          return;
        }
      }
    }

    setEditLoading(true);
    try {
      const updated = await window.electron?.profiles?.updateSecurity(
        editingProfile.id,
        editEnableSecurity ? editSecurityType : null,
        editEnableSecurity ? (editSecurityType === 'pin' ? editPinCode : editPassword) : null
      );
      if (updated) {
        setEditingProfile(updated);
        setEditPinCode('');
        setEditConfirmPin('');
        setEditPassword('');
        setEditConfirmPassword('');
        setEditSuccess(editEnableSecurity ? 'Security settings saved' : 'Security disabled');
        setTimeout(() => setEditSuccess(''), 3000);
        if (onSaved) onSaved();
      }
    } catch (err) {
      setEditError(err.message || 'Failed to update security');
    } finally {
      setEditLoading(false);
    }
  }

  function getAvatarSrc(avatar) {
    if (!avatar) return null;
    if (avatar.startsWith('/') || avatar.startsWith('file:')) return avatar;
    return `/${avatar}`;
  }

  return (
    <div className="space-y-lg">
      <div className="bg-surface rounded-card p-lg border border-border">
        <div className="flex items-center justify-between mb-md">
          <h2 className="text-lg font-bold text-text-primary">Profiles</h2>
          <button
            onClick={() => setShowAddProfile(!showAddProfile)}
            className="btn-primary text-sm"
          >
            + Add Profile
          </button>
        </div>

        {profileError && (
          <p className="text-danger text-sm mb-md">{profileError}</p>
        )}
        {profileSuccess && (
          <p className="text-success text-sm mb-md">{profileSuccess}</p>
        )}

        {showAddProfile && (
          <div className="bg-background rounded-lg p-md mb-md border border-border">
            <h3 className="text-sm font-medium text-text-primary mb-md">New Profile</h3>
            <div className="space-y-md">
              <input
                type="text"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                placeholder="Profile name"
                className="input-field"
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
              <input
                type="password"
                value={newProfilePin}
                onChange={(e) => setNewProfilePin(e.target.value)}
                placeholder="PIN (optional, 4 digits)"
                maxLength={4}
                className="input-field"
              />
              <div className="flex gap-md">
                <button onClick={handleAddProfile} className="btn-primary text-sm">
                  Create
                </button>
                <button
                  onClick={() => setShowAddProfile(false)}
                  className="btn-secondary text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {profilesLoading ? (
          <LoadingSkeleton />
        ) : profiles.length === 0 ? (
          <p className="text-text-muted text-sm text-center py-lg">No profiles found</p>
        ) : (
          <div className="space-y-sm">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                onClick={() => setEditingProfile(profile)}
                className="flex items-center justify-between p-md bg-background rounded-lg cursor-pointer hover:bg-accent/5 transition-colors"
              >
                <div className="flex items-center gap-md">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-background overflow-hidden shrink-0"
                    style={{ backgroundColor: profile.avatarColor || '#00E5FF' }}
                  >
                    {profile.avatar ? (
                      <img
                        src={getAvatarSrc(profile.avatar)}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      profile.name.charAt(0)
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">{profile.name}</p>
                    <p className="text-xs text-text-muted">
                      {profile.isMaster && 'Master'}
                      {profile.isKids && 'Kids'}
                      {!profile.isMaster && !profile.isKids && 'Standard'}
                      {profile.pinHash && ' • PIN Protected'}
                      {profile.passwordHash && ' • Password Protected'}
                    </p>
                  </div>
                </div>
                {!profile.isMaster && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProfile(profile.id);
                    }}
                    className="text-danger hover:text-danger/80 text-sm transition-colors"
                  >
                    Delete
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {editingProfile && (
        <div className="fixed inset-0 bg-overlay backdrop-blur-overlay z-50 flex items-center justify-center p-xl">
          <div className="w-full max-w-md bg-surface rounded-xl overflow-y-auto max-h-[90vh] shadow-xl border border-border">
            <div className="flex items-center justify-between px-lg py-md border-b border-border">
              <h3 className="text-lg font-bold text-text-primary">
                Edit {editingProfile.name}
              </h3>
              <button
                onClick={() => setEditingProfile(null)}
                className="text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex border-b border-border">
              <button
                onClick={() => setEditTab('profile')}
                className={`flex-1 py-sm text-sm font-medium transition-colors ${
                  editTab === 'profile'
                    ? 'text-accent border-b-2 border-accent'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                Profile
              </button>
              <button
                onClick={() => setEditTab('history')}
                className={`flex-1 py-sm text-sm font-medium transition-colors ${
                  editTab === 'history'
                    ? 'text-accent border-b-2 border-accent'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                History
              </button>
            </div>

            {editTab === 'profile' ? (
              <div className="p-lg space-y-lg">
                <div>
                  <h4 className="text-sm font-medium text-text-primary mb-md">Avatar</h4>
                  <AvatarPicker
                    currentAvatar={editAvatar}
                    currentColor={editingProfile.avatarColor}
                    profileName={editingProfile.name}
                    onSelect={handleEditAvatar}
                  />
                </div>

                <div className="border-t border-border pt-lg">
                  <h4 className="text-sm font-medium text-text-primary mb-md">Security</h4>
                  <form onSubmit={handleEditSaveSecurity} className="space-y-md">
                    <div className="flex items-center justify-between p-md bg-background rounded-card border border-border">
                      <div className="flex items-center gap-sm">
                        <Lock className="w-4 h-4 text-text-muted" />
                        <span className="text-sm text-text-primary">Enable Security</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditEnableSecurity(!editEnableSecurity)}
                        className={`w-10 h-5 rounded-full transition-colors relative ${
                          editEnableSecurity ? 'bg-accent' : 'bg-border'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-background absolute top-0.5 transition-transform ${
                            editEnableSecurity ? 'translate-x-5' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>

                    {editEnableSecurity && (
                      <>
                        <div className="flex gap-sm">
                          <button
                            type="button"
                            onClick={() => setEditSecurityType('pin')}
                            className={`flex-1 py-sm text-sm font-medium rounded-button border transition-colors ${
                              editSecurityType === 'pin'
                                ? 'bg-accent/10 border-accent text-accent'
                                : 'border-border text-text-muted hover:text-text-primary'
                            }`}
                          >
                            PIN Code
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditSecurityType('password')}
                            className={`flex-1 py-sm text-sm font-medium rounded-button border transition-colors ${
                              editSecurityType === 'password'
                                ? 'bg-accent/10 border-accent text-accent'
                                : 'border-border text-text-muted hover:text-text-primary'
                            }`}
                          >
                            Password
                          </button>
                        </div>

                        {editSecurityType === 'pin' ? (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-text-primary mb-xs">
                                Set 4-Digit PIN
                              </label>
                              <input
                                type="password"
                                value={editPinCode}
                                onChange={(e) => setEditPinCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                placeholder="Enter PIN"
                                className="input-field"
                                maxLength={4}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-text-primary mb-xs">
                                Confirm PIN
                              </label>
                              <input
                                type="password"
                                value={editConfirmPin}
                                onChange={(e) => setEditConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                placeholder="Confirm PIN"
                                className="input-field"
                                maxLength={4}
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-text-primary mb-xs">
                                Set Password
                              </label>
                              <div className="relative">
                                <input
                                  type={editShowPassword ? 'text' : 'password'}
                                  value={editPassword}
                                  onChange={(e) => setEditPassword(e.target.value)}
                                  placeholder="Enter password"
                                  className="input-field pr-10"
                                />
                                <button
                                  type="button"
                                  onClick={() => setEditShowPassword(!editShowPassword)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                                >
                                  {editShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-text-primary mb-xs">
                                Confirm Password
                              </label>
                              <div className="relative">
                                <input
                                  type={editShowConfirmPassword ? 'text' : 'password'}
                                  value={editConfirmPassword}
                                  onChange={(e) => setEditConfirmPassword(e.target.value)}
                                  placeholder="Confirm password"
                                  className="input-field pr-10"
                                />
                                <button
                                  type="button"
                                  onClick={() => setEditShowConfirmPassword(!editShowConfirmPassword)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                                >
                                  {editShowConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </>
                    )}

                    {editError && <p className="text-danger text-sm">{editError}</p>}
                    {editSuccess && <p className="text-success text-sm">{editSuccess}</p>}

                    <button
                      type="submit"
                      disabled={editLoading}
                      className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {editLoading ? 'Saving...' : 'Save Security'}
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="p-lg space-y-lg max-h-[50vh] overflow-y-auto">
                <div>
                  <h4 className="text-sm font-medium text-text-primary mb-md flex items-center gap-sm">
                    <Search className="w-4 h-4 text-text-muted" />
                    Recent Searches
                  </h4>
                  {searchHistory.length === 0 ? (
                    <p className="text-sm text-text-muted">No search history for this profile.</p>
                  ) : (
                    <div className="flex flex-wrap gap-sm">
                      {searchHistory.map((term) => (
                        <span
                          key={term}
                          className="px-md py-sm bg-background border border-border rounded-full text-sm text-text-muted"
                        >
                          {term}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-border pt-lg">
                  <h4 className="text-sm font-medium text-text-primary mb-md flex items-center gap-sm">
                    <Clock className="w-4 h-4 text-text-muted" />
                    Recently Watched
                  </h4>
                  {watchHistoryLoading ? (
                    <div className="space-y-sm">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-12 bg-background rounded-lg animate-pulse" />
                      ))}
                    </div>
                  ) : watchHistory.length === 0 ? (
                    <p className="text-sm text-text-muted">No watch history for this profile.</p>
                  ) : (
                    <div className="space-y-sm">
                      {watchHistory.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-md p-md bg-background rounded-lg"
                        >
                          <div className="w-10 h-14 rounded overflow-hidden bg-surface shrink-0">
                            {item.poster_path ? (
                              <img
                                src={`https://image.tmdb.org/t/p/w92${item.poster_path}`}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                {item.season ? <Tv className="w-4 h-4 text-text-muted" /> : <Film className="w-4 h-4 text-text-muted" />}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-text-primary truncate">{item.title}</p>
                            {item.season && (
                              <p className="text-xs text-text-muted mt-2xs">
                                Season {item.season}{item.episode ? ` · Episode ${item.episode}` : ''}
                              </p>
                            )}
                            <p className="text-xs text-text-muted mt-2xs">
                              {new Date(item.completed_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
