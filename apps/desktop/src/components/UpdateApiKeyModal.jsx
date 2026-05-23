import { useState } from 'react';

export default function UpdateApiKeyModal({ onClose, onSaved }) {
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
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
      onSaved?.(apiKey.trim());
      onClose();
    } catch (err) {
      await window.electron?.storage?.set('tmdbApiKey', '');
      setError('Invalid API key. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-overlay backdrop-blur-overlay z-50 flex items-center justify-center p-xl">
      <div className="w-full max-w-md bg-surface rounded-xl overflow-hidden shadow-xl border border-border">
        <div className="p-xl">
          <div className="text-center mb-xl">
            <img src="Logo.png" alt="Nexube" className="w-24 h-24 mx-auto mb-lg" />
            <h2 className="text-xl font-bold text-text-primary mb-sm">Update API Key</h2>
            <p className="text-sm text-text-muted">
              Your current TMDB API key is invalid. Enter a new key to continue.
            </p>
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
          </div>

          <form onSubmit={handleSubmit} className="space-y-md">
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

            <div className="flex gap-md">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary flex-1 py-md text-base"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex-1 py-md text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Validating...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
