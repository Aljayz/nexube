import { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import AvatarPicker from './AvatarPicker';

function SetupScreen({ onComplete }) {
  const [step, setStep] = useState(1);
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [enableSecurity, setEnableSecurity] = useState(false);
  const [securityType, setSecurityType] = useState('pin');
  const [masterName, setMasterName] = useState('Master');
  const [pinCode, setPinCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [avatar, setAvatar] = useState(null);

  const handleApiKeySubmit = async (e) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setError('Please enter your TMDB API key');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await window.electron?.storage?.set('tmdbApiKey', apiKey.trim());
      await window.electron?.tmdb?.fetch('/authentication', {});
      setStep(2);
    } catch (err) {
      await window.electron?.storage?.set('tmdbApiKey', '');
      setError('Invalid API key. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSecuritySubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!masterName.trim()) {
      setError('Profile name is required');
      return;
    }

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
      const profile = await window.electron?.profiles?.createProfile({
        name: masterName.trim(),
        isMaster: true,
        isKids: false,
        pinHash: enableSecurity && securityType === 'pin' ? pinCode : null,
        password: enableSecurity && securityType === 'password' ? password : null,
        securityType: enableSecurity ? securityType : null,
        avatar: avatar || null,
      });

      if (profile) {
        await window.electron?.profiles?.setActiveProfile(profile.id);
        onComplete();
      }
    } catch (err) {
      setError(err.message || 'Failed to create master account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-background">
      <div className="w-full max-w-md px-xl">
        <div className="text-center mb-xl">
          <img src="Logo.png" alt="Nexube" className="w-48 h-48 mx-auto mb-lg" />
          <h1 className="text-2xl font-bold text-text-primary mb-sm">
            {step === 1 ? (
              <span className="flex items-center justify-center gap-1">
                Welcome to <img src="Name.png" alt="Nexube" className="w-auto h-7" />
              </span>
            ) : 'Secure Your Account'}
          </h1>
          <p className="text-text-muted">
            {step === 1
              ? 'Enter your TMDB API key to get started.'
              : 'Set up security for your Master Account.'}
          </p>
          {step === 1 && (
            <p className="text-xs text-text-disabled mt-sm">
              Get a free API key at{' '}
              <a
                href="https://www.themoviedb.org/settings/api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                themoviedb.org
              </a>
            </p>
          )}
        </div>

        {step === 1 && (
          <form onSubmit={handleApiKeySubmit} className="space-y-md">
            <div>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setError('');
                }}
                placeholder="Enter your TMDB API key"
                className="input-field"
                autoFocus
              />
            </div>

            {error && (
              <p className="text-danger text-sm text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-md text-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Validating...' : 'Continue'}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleSecuritySubmit} className="space-y-md">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-xs">
                Profile Name
              </label>
              <input
                type="text"
                value={masterName}
                onChange={(e) => setMasterName(e.target.value)}
                placeholder="Master"
                className="input-field"
                maxLength={20}
              />
            </div>

            <div className="bg-surface rounded-card p-lg border border-border">
              <AvatarPicker
                currentAvatar={avatar}
                currentColor="#00E5FF"
                profileName={masterName || 'Master'}
                onSelect={setAvatar}
              />
            </div>

            <div className="flex items-center justify-between p-md bg-surface rounded-card border border-border">
              <div className="flex items-center gap-sm">
                <Lock className="w-4 h-4 text-text-muted" />
                <span className="text-sm text-text-primary">Enable Security</span>
              </div>
              <button
                type="button"
                onClick={() => setEnableSecurity(!enableSecurity)}
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
                        onChange={(e) => setPinCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="Enter PIN"
                        className="input-field"
                        maxLength={4}
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-xs">
                        Confirm PIN
                      </label>
                      <input
                        type="password"
                        value={confirmPin}
                        onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
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
                          onChange={(e) => setPassword(e.target.value)}
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
                          onChange={(e) => setConfirmPassword(e.target.value)}
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

            {error && (
              <p className="text-danger text-sm text-center">{error}</p>
            )}

            <div className="flex gap-md">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="btn-secondary flex-1"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex-1 py-md text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Master Account'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default SetupScreen;
