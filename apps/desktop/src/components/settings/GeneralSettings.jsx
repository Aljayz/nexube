import { useState, useEffect, useRef } from 'react';
import { Check, Eye, EyeOff, Lock, ExternalLink, Subtitles, Globe, Loader2, ChevronDown } from 'lucide-react';

const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ru', label: 'Russian' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ar', label: 'Arabic' },
  { code: 'nl', label: 'Dutch' },
  { code: 'pl', label: 'Polish' },
  { code: 'sv', label: 'Swedish' },
  { code: 'tr', label: 'Turkish' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'th', label: 'Thai' },
  { code: 'id', label: 'Indonesian' },
];

export default function GeneralSettings({
  apiKey,
  setApiKey,
  kidsFilterCountry,
  setKidsFilterCountry,
  onSaveKidsCountry,
  activeProfile,
  wyzieApiKey,
  setWyzieApiKey,
  subdlApiKey,
  setSubdlApiKey,
  subtitleLanguages,
  setSubtitleLanguages,
  subtitleSources,
  setSubtitleSources,
  subtitleProvider,
  setSubtitleProvider,
}) {
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [apiKeyLoading, setApiKeyLoading] = useState(false);
  const [apiKeyError, setApiKeyError] = useState('');
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [showPinVerification, setShowPinVerification] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [saveStatus, setSaveStatus] = useState({});
  const [wyzieKeySaved, setWyzieKeySaved] = useState(false);
  const [wyzieRedeeming, setWyzieRedeeming] = useState(false);
  const [wyzieError, setWyzieError] = useState('');
  const [subdlKeySaved, setSubdlKeySaved] = useState(false);
  const [subdlError, setSubdlError] = useState('');
  const [langOpen, setLangOpen] = useState(false);
  const [availableSources, setAvailableSources] = useState([]);
  const [sourcesTiered, setSourcesTiered] = useState([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [selectedSources, setSelectedSources] = useState(subtitleSources === 'all' ? [] : subtitleSources.split(','));
  const langRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (langRef.current && !langRef.current.contains(e.target)) {
        setLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!wyzieApiKey.trim()) return;
    (async () => {
      setSourcesLoading(true);
      try {
        const result = await window.electron?.deskDownloads?.getSources();
        if (result?.success) {
          const freeKeys = Array.isArray(result.free) ? result.free : [];
          const tiered = Array.isArray(result.tiered) ? result.tiered : [];
          const tieredMap = {};
          tiered.forEach((s) => { tieredMap[s.key] = s; });
          const freeSources = freeKeys.map((key) =>
            tieredMap[key] || { key, name: key, tier: 'free', available: true }
          );
          setAvailableSources(freeKeys);
          setSourcesTiered(freeSources);
          if (!subtitleSources || subtitleSources === 'all') {
            setSelectedSources(freeKeys);
          } else {
            setSelectedSources(subtitleSources.split(','));
          }
        }
      } catch {}
      setSourcesLoading(false);
    })();
  }, [wyzieApiKey]);

  const handleToggleSource = (sourceKey) => {
    setSelectedSources((prev) => {
      const next = prev.includes(sourceKey)
        ? prev.filter((s) => s !== sourceKey)
        : [...prev, sourceKey];
      return next;
    });
  };

  const handleToggleAllSources = () => {
    if (selectedSources.length === availableSources.length) {
      setSelectedSources([]);
    } else {
      setSelectedSources([...availableSources]);
    }
  };

  const handleSetProvider = async (provider) => {
    setSubtitleProvider(provider);
    await window.electron?.storage?.set('subtitleProvider', provider);
    setSaveStatus((prev) => ({ ...prev, subtitleProvider: 'saved' }));
    setTimeout(() => setSaveStatus((prev) => ({ ...prev, subtitleProvider: null })), 2000);
  };

  const handleSaveSources = async () => {
    const value = selectedSources.length === availableSources.length ? 'all' : selectedSources.join(',');
    try {
      await window.electron?.storage?.set('subtitleSources', value);
      setSubtitleSources(value);
      setSaveStatus((prev) => ({ ...prev, subtitleSources: 'saved' }));
      setTimeout(() => setSaveStatus((prev) => ({ ...prev, subtitleSources: null })), 2000);
    } catch {
      setSaveStatus((prev) => ({ ...prev, subtitleSources: 'error' }));
    }
  };

  const handleSaveApiKey = async () => {
    setApiKeyLoading(true);
    setApiKeyError('');
    setApiKeySaved(false);

    try {
      if (!apiKey.trim()) throw new Error('API key cannot be empty');

      await window.electron?.storage?.set('tmdbApiKey', apiKey.trim());
      const result = await window.electron?.tmdb?.fetch('/authentication', {});

      if (!result) throw new Error('Failed to validate API key');

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

  const handleSaveWyzieKey = async () => {
    try {
      if (!wyzieApiKey.trim()) throw new Error('API key cannot be empty');
      await window.electron?.storage?.set('wyzieApiKey', wyzieApiKey.trim());
      setWyzieKeySaved(true);
      setTimeout(() => setWyzieKeySaved(false), 3000);
    } catch (err) {
      setSaveStatus((prev) => ({ ...prev, wyzieKey: err.message }));
      setTimeout(() => setSaveStatus((prev) => ({ ...prev, wyzieKey: null })), 3000);
    }
  };

  const handleSaveSubdlKey = async () => {
    try {
      if (!subdlApiKey.trim()) throw new Error('API key cannot be empty');
      await window.electron?.storage?.set('subdlApiKey', subdlApiKey.trim());
      setSubdlKeySaved(true);
      setTimeout(() => setSubdlKeySaved(false), 3000);
    } catch (err) {
      setSubdlError(err.message);
      setTimeout(() => setSubdlError(''), 3000);
    }
  };

  const handleWyzieRedeem = async () => {
    if (!window.electron?.wyzie) return;
    setWyzieRedeeming(true);
    setWyzieError('');
    try {
      const res = await window.electron.wyzie.openRedeem();
      if (res.cancelled) {
        setWyzieRedeeming(false);
        return;
      }
      if (res.ok && res.key) {
        setWyzieApiKey(res.key);
        await window.electron.storage.set('wyzieApiKey', res.key);
        setWyzieKeySaved(true);
        setTimeout(() => setWyzieKeySaved(false), 3000);
      } else {
        setWyzieError('Could not extract key automatically. Try entering it manually.');
      }
    } catch (e) {
      setWyzieError(e.message);
    }
    setWyzieRedeeming(false);
  };

  const handleToggleLanguage = (code) => {
    setSubtitleLanguages((prev) =>
      prev.includes(code) ? prev.filter((l) => l !== code) : [...prev, code]
    );
  };

  const handleSaveLanguages = async () => {
    try {
      if (subtitleLanguages.length === 0) throw new Error('Select at least one language');
      await window.electron?.storage?.set('subtitleLanguages', subtitleLanguages);
      setSaveStatus((prev) => ({ ...prev, subtitleLangs: 'saved' }));
      setTimeout(() => setSaveStatus((prev) => ({ ...prev, subtitleLangs: null })), 2000);
    } catch (err) {
      setSaveStatus((prev) => ({ ...prev, subtitleLangs: 'error' }));
    }
  };

  const activeBtn = 'bg-accent text-background border-accent';
  const inactiveBtn = 'bg-surface text-text-muted border-border hover:border-accent';

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
        <div className="flex items-center gap-sm mb-md">
          <Subtitles className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-bold text-text-primary">Wyzie Subtitles</h2>
        </div>
        <p className="text-sm text-text-muted mb-md">
          Your API key is stored locally and used to fetch subtitles for downloaded content.
        </p>
        {saveStatus.wyzieKey && (
          <p className="text-danger text-sm mb-md">{saveStatus.wyzieKey}</p>
        )}
        <div className="flex gap-md mb-md">
          <input
            type="password"
            value={wyzieApiKey}
            onChange={(e) => {
              setWyzieApiKey(e.target.value);
              setWyzieKeySaved(false);
            }}
            placeholder="Enter your Wyzie API key"
            className="input-field flex-1"
          />
          <button
            onClick={handleSaveWyzieKey}
            className="btn-primary disabled:opacity-50"
          >
            {wyzieKeySaved ? (
              <span className="flex items-center gap-sm">
                <Check className="w-4 h-4" /> Saved
              </span>
            ) : 'Save'}
          </button>
        </div>
        {wyzieRedeeming ? (
          <span className="text-sm text-text-muted flex items-center gap-xs">
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            Complete the captcha in the popup window…
          </span>
        ) : !wyzieApiKey.trim() ? (
          <button
            onClick={handleWyzieRedeem}
            className="text-accent text-sm flex items-center gap-xs hover:underline"
          >
            <ExternalLink className="w-3 h-3" /> Get a free API key
          </button>
        ) : null}
        {wyzieError && (
          <p className="text-danger text-sm mt-sm">{wyzieError}</p>
        )}
      </div>

      <div className="bg-surface rounded-card p-lg border border-border">
        <div className="flex items-center gap-sm mb-md">
          <Subtitles className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-bold text-text-primary">SubDL Subtitles</h2>
        </div>
        <p className="text-sm text-text-muted mb-md">
          Add a free SubDL API key for an additional subtitle source. Get one at <a href="https://subdl.com" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">subdl.com</a>.
        </p>
        {subdlError && (
          <p className="text-danger text-sm mb-md">{subdlError}</p>
        )}
        <div className="flex gap-md">
          <input
            type="password"
            value={subdlApiKey}
            onChange={(e) => {
              setSubdlApiKey(e.target.value);
              setSubdlKeySaved(false);
            }}
            placeholder="Enter your SubDL API key"
            className="input-field flex-1"
          />
          <button
            onClick={handleSaveSubdlKey}
            className="btn-primary disabled:opacity-50"
          >
            {subdlKeySaved ? (
              <span className="flex items-center gap-sm">
                <Check className="w-4 h-4" /> Saved
              </span>
            ) : 'Save'}
          </button>
        </div>
      </div>

      <div className="bg-surface rounded-card p-lg border border-border">
        <h3 className="text-md font-semibold text-text-primary mb-sm">Subtitle Languages</h3>
        <p className="text-sm text-text-muted mb-md">
          Select the languages you want to download subtitles for.
        </p>

        <div className="relative mb-md" ref={langRef}>
          <button
            onClick={() => setLangOpen((v) => !v)}
            className="w-full flex items-center gap-sm px-sm py-sm rounded border border-border bg-background text-text-primary text-sm hover:border-accent transition-colors text-left"
          >
            <Globe className="w-4 h-4 shrink-0 text-text-muted" />
            <span className="flex-1 truncate">
              {subtitleLanguages.length === 0
                ? 'Select languages'
                : subtitleLanguages.length === 1
                  ? LANGUAGE_OPTIONS.find((l) => l.code === subtitleLanguages[0])?.label || subtitleLanguages[0]
                  : `${subtitleLanguages.length} languages selected`}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-text-muted transition-transform ${langOpen ? 'rotate-180' : ''}`} />
          </button>
          {langOpen && (
            <div className="absolute top-full left-0 right-0 mt-xs z-10 bg-surface border border-border rounded-xl shadow-lg max-h-60 overflow-y-auto">
              {LANGUAGE_OPTIONS.map((lang) => (
                <label
                  key={lang.code}
                  className="flex items-center gap-sm px-sm py-2xs hover:bg-background cursor-pointer text-sm text-text-primary transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={subtitleLanguages.includes(lang.code)}
                    onChange={() => handleToggleLanguage(lang.code)}
                    className="w-3.5 h-3.5 accent-accent"
                  />
                  {lang.label}
                </label>
              ))}
            </div>
          )}
        </div>

        {saveStatus.subtitleLangs === 'error' && (
          <p className="text-danger text-sm mb-md">Select at least one language.</p>
        )}
        <button onClick={handleSaveLanguages} className="btn-primary">
          {saveStatus.subtitleLangs === 'saved' ? (
            <span className="flex items-center gap-sm">
              <Check className="w-4 h-4" /> Saved
            </span>
          ) : 'Save Languages'}
        </button>

        <hr className="border-border my-md" />

        <h3 className="text-md font-semibold text-text-primary mb-sm">Subtitle Provider</h3>
        <p className="text-sm text-text-muted mb-md">
          Choose which subtitle service to use when fetching subtitles.
        </p>
        <div className="flex gap-sm mb-md">
          <button
            onClick={() => handleSetProvider('wyzie')}
            className={`px-md py-sm rounded-button text-sm border transition-colors ${
              subtitleProvider === 'wyzie' ? activeBtn : inactiveBtn
            }`}
          >
            Wyzie
          </button>
          <button
            onClick={() => handleSetProvider('subdl')}
            className={`px-md py-sm rounded-button text-sm border transition-colors ${
              subtitleProvider === 'subdl' ? activeBtn : inactiveBtn
            }`}
          >
            SubDL
          </button>
        </div>
        {saveStatus.subtitleProvider === 'saved' && (
          <p className="text-success text-sm mb-md">Provider saved.</p>
        )}

        <hr className="border-border my-md" />

        <h3 className="text-md font-semibold text-text-primary mb-sm flex items-center gap-sm">
          <Globe className="w-4 h-4 text-accent" />
          Subtitle Sources
        </h3>
        <p className="text-sm text-text-muted mb-md">
          Choose which providers to search for subtitles.
        </p>
        {sourcesLoading ? (
          <div className="flex items-center gap-sm text-text-muted text-sm mb-md">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Loading sources...</span>
          </div>
        ) : availableSources.length > 0 ? (
          <>
            <div className="flex flex-wrap gap-sm mb-md">
              <button
                onClick={handleToggleAllSources}
                className={`px-sm py-xs rounded-md text-sm border transition-colors ${
                  selectedSources.length === availableSources.length
                    ? activeBtn
                    : inactiveBtn
                }`}
              >
                All Sources
              </button>
              {sourcesTiered.map((s) => {
                const isAvailable = s.available !== false;
                return (
                  <button
                    key={s.key}
                    onClick={() => handleToggleSource(s.key)}
                    className={`px-sm py-xs rounded-md text-sm border transition-colors flex items-center gap-1 ${
                      selectedSources.includes(s.key)
                        ? isAvailable
                          ? activeBtn
                          : 'bg-accent/40 text-background/70 border-accent/40'
                        : inactiveBtn
                    }`}
                    title={!isAvailable ? 'Requires a Pro key' : s.name}
                  >
                    {s.name}
                    {!isAvailable && <Lock className="w-3 h-3" />}
                  </button>
                );
              })}
            </div>
            {saveStatus.subtitleSources === 'error' && (
              <p className="text-danger text-sm mb-md">Failed to save sources.</p>
            )}
            <button onClick={handleSaveSources} className="btn-primary">
              {saveStatus.subtitleSources === 'saved' ? (
                <span className="flex items-center gap-sm">
                  <Check className="w-4 h-4" /> Saved
                </span>
              ) : 'Save Sources'}
            </button>
          </>
        ) : (
          <p className="text-sm text-text-muted mb-md">Save a Wyzie API key to load available sources.</p>
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
