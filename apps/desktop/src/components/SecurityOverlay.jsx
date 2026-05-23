import { useState, useCallback, useRef, useEffect } from 'react';
import { Check, Eye, EyeOff } from 'lucide-react';

function SecurityOverlay({ target, onSuccess, onCancel }) {
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const securityType = target?.profile?.securityType || 'pin';

  const handleDigit = useCallback((digit) => {
    if (pin.length < 4) {
      setPin((prev) => prev + digit);
      setError('');
    }
  }, [pin]);

  const handleBackspace = useCallback(() => {
    setPin((prev) => prev.slice(0, -1));
    setError('');
  }, []);

  const handleSubmit = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      let isValid = false;

      if (securityType === 'pin') {
        if (pin.length !== 4) {
          setError('Please enter 4 digits');
          setLoading(false);
          return;
        }
        isValid = await window.electron?.profiles?.verifyPin(target?.profile?.id, pin);
      } else {
        if (!password) {
          setError('Password is required');
          setLoading(false);
          return;
        }
        isValid = await window.electron?.profiles?.verifyPassword(target?.profile?.id, password);
      }

      if (isValid) {
        onSuccess();
      } else {
        setError(securityType === 'pin' ? 'Incorrect PIN' : 'Incorrect password');
        setPin('');
        setPassword('');
      }
    } catch (err) {
      setError('Verification failed');
    } finally {
      setLoading(false);
    }
  }, [pin, password, securityType, target, onSuccess]);

  const pinInputRef = useRef(null);

  useEffect(() => {
    if (securityType === 'pin' && pinInputRef.current) {
      pinInputRef.current.focus();
    }
  }, [securityType]);

  const handlePinKeyDown = useCallback((e) => {
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      handleDigit(e.key);
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      handleBackspace();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleDigit, handleBackspace, handleSubmit]);

  if (securityType === 'password') {
    return (
      <div className="fixed inset-0 bg-overlay backdrop-blur-overlay flex items-center justify-center z-50">
        <div className="bg-surface rounded-xl p-xl w-80 shadow-xl">
          <div className="text-center mb-lg">
            <img src="Logo.png" alt="Nexube" className="w-16 h-16 mx-auto mb-md" />
            <h2 className="text-xl font-bold text-text-primary">Enter Password</h2>
            <p className="text-sm text-text-muted mt-sm">
              {target?.type === 'profile-create'
                ? 'Master password required to create profiles'
                : `Enter password to access ${target?.profile?.name || 'this profile'}`}
            </p>
          </div>

          <div className="relative mb-lg">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="Enter password"
              className="input-field pr-10 text-center text-lg"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {error && (
            <p className="text-center text-danger text-sm mb-md">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !password}
            className="w-full h-14 rounded-lg bg-accent hover:bg-accent-hover text-background text-lg font-bold transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed mb-md"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Check className="w-5 h-5" />
            )}
          </button>

          <button
            onClick={onCancel}
            className="w-full py-sm text-text-muted hover:text-text-primary text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-overlay backdrop-blur-overlay flex items-center justify-center z-50">
      <div className="bg-surface rounded-xl p-xl w-80 shadow-xl">
        <div className="text-center mb-lg">
          <img src="Logo.png" alt="Nexube" className="w-16 h-16 mx-auto mb-md" />
          <h2 className="text-xl font-bold text-text-primary">Enter PIN</h2>
          <p className="text-sm text-text-muted mt-sm">
            {target?.type === 'profile-create'
              ? 'Master PIN required to create profiles'
              : `Enter PIN to access ${target?.profile?.name || 'this profile'}`}
          </p>
        </div>

        <input
          ref={pinInputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          readOnly
          value=""
          onKeyDown={handlePinKeyDown}
          className="sr-only"
          aria-hidden="true"
        />

        <div
          className="flex justify-center gap-md mb-lg cursor-text"
          onClick={() => pinInputRef.current?.focus()}
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center text-xl font-bold transition-colors ${
                pin.length > i
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border text-text-muted'
              }`}
            >
              {pin.length > i && <div className="w-3 h-3 rounded-full bg-accent" />}
            </div>
          ))}
        </div>

        {error && (
          <p className="text-center text-danger text-sm mb-md">{error}</p>
        )}

        <div className="flex gap-md">
          <button
            onClick={handleSubmit}
            disabled={loading || pin.length !== 4}
            className="flex-1 h-14 rounded-lg bg-accent hover:bg-accent-hover text-background text-lg font-bold transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Check className="w-5 h-5" />
            )}
          </button>

          <button
            onClick={onCancel}
            className="flex-1 h-14 rounded-lg bg-surface-hover hover:bg-border text-text-primary text-lg font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default SecurityOverlay;
