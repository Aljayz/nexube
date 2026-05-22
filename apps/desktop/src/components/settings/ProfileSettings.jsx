import { useState, useEffect } from 'react';
import { Check, Eye, EyeOff, Lock, Image } from 'lucide-react';
import AvatarPicker from '../AvatarPicker';

export default function ProfileSettings({ activeProfile, onSaved }) {
  const [profile, setProfile] = useState(activeProfile);
  const [enableSecurity, setEnableSecurity] = useState(!!activeProfile?.securityType);
  const [securityType, setSecurityType] = useState(activeProfile?.securityType || 'pin');
  const [pinCode, setPinCode] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [avatar, setAvatar] = useState(activeProfile?.avatar || null);
  const [avatarChanged, setAvatarChanged] = useState(false);
  const [securityDirty, setSecurityDirty] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const p = await window.electron?.profiles?.getProfile(activeProfile?.id);
    if (p) {
      setProfile(p);
      setAvatar(p.avatar || null);
      setEnableSecurity(!!p.securityType);
      setSecurityType(p.securityType || 'pin');
      setAvatarChanged(false);
      setSecurityDirty(false);
    }
  }

  function handleAvatarSelect(newAvatar) {
    setAvatar(newAvatar);
    setAvatarChanged(true);
  }

  async function handleAvatarSave() {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await window.electron?.profiles?.updateProfile(profile.id, { avatar });
      const updated = await window.electron?.profiles?.getProfile(profile.id);
      if (updated) {
        setProfile(updated);
        setAvatar(updated.avatar || null);
      }
      setAvatarChanged(false);
      setSuccess('Avatar saved');
      setTimeout(() => setSuccess(''), 3000);
      if (onSaved) onSaved();
    } catch (err) {
      setError(err.message || 'Failed to save avatar');
    } finally {
      setLoading(false);
    }
  }

  async function handleSecuritySave(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (enableSecurity) {
      if (securityType === 'pin') {
        if (pinCode.length !== 4 || !/^\d{4}$/.test(pinCode)) {
          setError('PIN must be exactly 4 digits');
          return;
        }
        if (pinCode !== confirmPin) {
          setError('PINs do not match');
          return;
        }
      } else {
        if (password.length < 4) {
          setError('Password must be at least 4 characters');
          return;
        }
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          return;
        }
      }
    }

    setLoading(true);
    try {
      await window.electron?.profiles?.updateSecurity(
        profile.id,
        enableSecurity ? securityType : null,
        enableSecurity ? (securityType === 'pin' ? pinCode : password) : null
      );

      const updated = await window.electron?.profiles?.getProfile(profile.id);
      if (updated) {
        setProfile(updated);
        setEnableSecurity(!!updated.securityType);
        setSecurityType(updated.securityType || 'pin');
      }

      setPinCode('');
      setConfirmPin('');
      setPassword('');
      setConfirmPassword('');
      setSecurityDirty(false);
      setSuccess('Security saved');
      setTimeout(() => setSuccess(''), 3000);

      if (onSaved) onSaved();
    } catch (err) {
      setError(err.message || 'Failed to save security');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-lg">
      <div className="bg-surface rounded-card p-lg border border-border">
        <h2 className="text-lg font-bold text-text-primary mb-md">Profile Avatar</h2>
        <AvatarPicker
          currentAvatar={avatar}
          currentColor={profile?.avatarColor}
          profileName={profile?.name}
          onSelect={handleAvatarSelect}
        />
        <div className="mt-md">
          <button
            onClick={handleAvatarSave}
            disabled={loading || !avatarChanged}
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-sm">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Saving...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-sm">
                <Image className="w-4 h-4" />
                Save Avatar
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="bg-surface rounded-card p-lg border border-border">
        <h2 className="text-lg font-bold text-text-primary mb-md">Security</h2>

        <div className="space-y-md">
          <div className="flex items-center justify-between p-md bg-background rounded-card border border-border">
            <div className="flex items-center gap-sm">
              <Lock className="w-4 h-4 text-text-muted" />
              <span className="text-sm text-text-primary">Enable Security</span>
            </div>
            <button
              type="button"
              onClick={() => { setEnableSecurity(!enableSecurity); setSecurityDirty(true); }}
              className={`w-10 h-5 rounded-full transition-colors relative ${
                enableSecurity ? 'bg-accent' : 'bg-border'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-background absolute top-0.5 transition-transform ${
                  enableSecurity ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {enableSecurity && (
            <>
              <div className="flex gap-sm">
                <button
                  type="button"
                  onClick={() => setSecurityType('pin')}
                  className={`flex-1 py-sm text-sm font-medium rounded-button border transition-colors ${
                    securityType === 'pin'
                      ? 'bg-accent/10 border-accent text-accent'
                      : 'border-border text-text-muted hover:text-text-primary'
                  }`}
                >
                  PIN Code
                </button>
                <button
                  type="button"
                  onClick={() => setSecurityType('password')}
                  className={`flex-1 py-sm text-sm font-medium rounded-button border transition-colors ${
                    securityType === 'password'
                      ? 'bg-accent/10 border-accent text-accent'
                      : 'border-border text-text-muted hover:text-text-primary'
                  }`}
                >
                  Password
                </button>
              </div>

              {securityType === 'pin' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-xs">
                      Set 4-Digit PIN
                    </label>
                    <input
                      type="password"
                      value={pinCode}
                      onChange={(e) => { setPinCode(e.target.value.replace(/\D/g, '').slice(0, 4)); setSecurityDirty(true); }}
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
                      value={confirmPin}
                      onChange={(e) => { setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setSecurityDirty(true); }}
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
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setSecurityDirty(true); }}
                        placeholder="Enter password"
                        className="input-field pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-xs">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => { setConfirmPassword(e.target.value); setSecurityDirty(true); }}
                        placeholder="Confirm password"
                        className="input-field pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {error && <p className="text-danger text-sm">{error}</p>}
          {success && <p className="text-success text-sm">{success}</p>}

          <button
            onClick={handleSecuritySave}
            disabled={loading || !securityDirty}
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-sm">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Saving...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-sm">
                <Check className="w-4 h-4" />
                {success ? 'Saved' : 'Save Security'}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
