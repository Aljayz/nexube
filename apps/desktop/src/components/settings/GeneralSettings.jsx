import { useState } from 'react';
import { Check, Eye, EyeOff, Lock } from 'lucide-react';

export default function GeneralSettings({
  apiKey,
  setApiKey,
  kidsFilterCountry,
  setKidsFilterCountry,
  onSaveKidsCountry,
  activeProfile,
}) {
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [apiKeyLoading, setApiKeyLoading] = useState(false);
  const [apiKeyError, setApiKeyError] = useState('');
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [showPinVerification, setShowPinVerification] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [saveStatus, setSaveStatus] = useState({});

  const handleSaveApiKey = async () => {
    setApiKeyLoading(true);
    setApiKeyError('');
    setApiKeySaved(false);

    try {
      if (!apiKey.trim()) {
        throw new Error('API key cannot be empty');
      }

      await window.electron?.storage?.set('tmdbApiKey', apiKey.trim());
      const result = await window.electron?.tmdb?.fetch('/authentication', {});

      if (!result) {
        throw new Error('Failed to validate API key');
      }

      setApiKeySaved(true);
      setApiKeyVisible(false);
      setTimeout(() => setApiKeySaved(false), 3000);
    } catch (err) {
      setApiKeyError(err.message || 'Invalid API key');
    } finally {
      setApiKeyLoading(false);
    }
  };

  const handleRevealApiKey = async () => {
    if (activeProfile?.pinHash) {
      setShowPinVerification(true);
      setPinError('');
      setPinInput('');
    } else {
      setApiKeyVisible(true);
    }
  };

  const handlePinVerify = async () => {
    if (pinInput.length !== 4) {
      setPinError('PIN must be 4 digits');
      return;
    }

    try {
      const isValid = await window.electron?.profiles?.verifyPin(activeProfile?.id, pinInput);
      if (isValid) {
        setApiKeyVisible(true);
        setShowPinVerification(false);
        setPinInput('');
        setPinError('');
      } else {
        setPinError('Incorrect PIN');
      }
    } catch (err) {
      setPinError('Failed to verify PIN');
    }
  };

  const handleHideApiKey = () => {
    setApiKeyVisible(false);
    setShowPinVerification(false);
    setPinInput('');
    setPinError('');
  };

  const handleSaveKidsCountry = async () => {
    try {
      await onSaveKidsCountry(kidsFilterCountry);
      setSaveStatus((prev) => ({ ...prev, kidsCountry: 'saved' }));
      setTimeout(() => setSaveStatus((prev) => ({ ...prev, kidsCountry: null })), 2000);
    } catch (err) {
      setSaveStatus((prev) => ({ ...prev, kidsCountry: 'error' }));
    }
  };

  return (
    <div className="space-y-lg">
      <div className="bg-surface rounded-card p-lg border border-border">
        <h2 className="text-lg font-bold text-text-primary mb-md">TMDB API Key</h2>
        <p className="text-sm text-text-muted mb-md">
          Your API key is stored locally and used to fetch movie and TV show data.
        </p>
        {apiKeyError && (
          <p className="text-danger text-sm mb-md">{apiKeyError}</p>
        )}

        {showPinVerification ? (
          <div className="bg-background rounded-lg p-md border border-border">
            <div className="flex items-center gap-sm mb-md">
              <Lock className="w-4 h-4 text-accent" />
              <p className="text-sm font-medium text-text-primary">Enter PIN to reveal API key</p>
            </div>
            {pinError && <p className="text-danger text-sm mb-md">{pinError}</p>}
            <div className="flex gap-md">
              <input
                type="password"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="Enter 4-digit PIN"
                maxLength={4}
                className="input-field w-48"
                autoFocus
              />
              <button onClick={handlePinVerify} className="btn-primary text-sm">
                Verify
              </button>
              <button onClick={handleHideApiKey} className="btn-secondary text-sm">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-md">
            <input
              type={apiKeyVisible ? 'text' : 'password'}
              value={apiKeyVisible ? apiKey : '••••••••••••••••'}
              onChange={(e) => {
                setApiKey(e.target.value);
                setApiKeyError('');
              }}
              placeholder="Enter your TMDB API key"
              className="input-field flex-1"
              readOnly={!apiKeyVisible}
            />
            <button
              onClick={apiKeyVisible ? handleHideApiKey : handleRevealApiKey}
              className="btn-secondary px-sm"
            >
              {apiKeyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button
              onClick={handleSaveApiKey}
              disabled={apiKeyLoading}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {apiKeyLoading ? (
                <span className="flex items-center gap-sm">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Validating...
                </span>
              ) : apiKeySaved ? (
                <span className="flex items-center gap-sm">
                  <Check className="w-4 h-4" />
                  Saved
                </span>
              ) : 'Save'}
            </button>
          </div>
        )}
      </div>

      <div className="bg-surface rounded-card p-lg border border-border">
        <h2 className="text-lg font-bold text-text-primary mb-md">Kids Filter Country</h2>
        <p className="text-sm text-text-muted mb-md">
          Select the country certification system to use for kids profile filtering.
        </p>
        <div className="flex gap-md items-center">
          <select
            value={kidsFilterCountry}
            onChange={(e) => setKidsFilterCountry(e.target.value)}
            className="input-field w-48"
          >
            <option value="US">United States (US)</option>
            <option value="GB">United Kingdom (GB)</option>
            <option value="DE">Germany (DE)</option>
            <option value="JP">Japan (JP)</option>
            <option value="AU">Australia (AU)</option>
            <option value="CA">Canada (CA)</option>
          </select>
          <button onClick={handleSaveKidsCountry} className="btn-primary">
            {saveStatus.kidsCountry === 'saved' ? (
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
