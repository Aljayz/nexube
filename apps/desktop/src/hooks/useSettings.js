import { useState, useEffect, useCallback } from 'react';

export function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}` : '0 229 255';
}

export function applyAccentColor(color) {
  const rgb = hexToRgb(color);
  let styleEl = document.getElementById('accent-override');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'accent-override';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `
    :root { --accent: ${rgb}; --accent-hover: ${rgb}; }
    .bg-accent { background-color: rgb(${rgb}) !important; }
    .text-accent { color: rgb(${rgb}) !important; }
    .border-accent { border-color: rgb(${rgb}) !important; }
    .border-accent\\/50 { border-color: rgba(${rgb}, 0.5) !important; }
    .border-accent\\/30 { border-color: rgba(${rgb}, 0.3) !important; }
    .border-accent\\/20 { border-color: rgba(${rgb}, 0.2) !important; }
    .border-accent\\/10 { border-color: rgba(${rgb}, 0.1) !important; }
    .bg-accent\\/10 { background-color: rgba(${rgb}, 0.1) !important; }
    .bg-accent\\/20 { background-color: rgba(${rgb}, 0.2) !important; }
    .bg-accent\\/90 { background-color: rgba(${rgb}, 0.9) !important; }
    .hover\\:text-accent:hover { color: rgb(${rgb}) !important; }
    .hover\\:bg-accent\\/10:hover { background-color: rgba(${rgb}, 0.1) !important; }
    .hover\\:border-accent\\/50:hover { border-color: rgba(${rgb}, 0.5) !important; }
    .focus\\:border-accent:focus { border-color: rgb(${rgb}) !important; }
    .ring-accent { --tw-ring-color: rgb(${rgb}) !important; }
    .ring-offset-accent { --tw-ring-offset-color: rgb(${rgb}) !important; }
    .from-accent { --tw-gradient-from: rgb(${rgb}) !important; }
    .to-accent { --tw-gradient-to: rgb(${rgb}) !important; }
    .via-accent { --tw-gradient-via: rgb(${rgb}) !important; }
    .btn-primary { background-color: rgb(${rgb}) !important; }
    .btn-primary:hover { background-color: rgb(${rgb}) !important; }
    .accent-accent { accent-color: rgb(${rgb}) !important; }
    .hover\\:text-accent\\/80:hover { color: rgba(${rgb}, 0.8) !important; }
  `;
}

export function useSettings() {
  const [apiKey, setApiKey] = useState('');
  const [kidsFilterCountry, setKidsFilterCountry] = useState('US');

  useEffect(() => {
    async function loadSettings() {
      try {
        const key = await window.electron?.storage?.get('tmdbApiKey');
        setApiKey(key || '');

        const country = await window.electron?.storage?.get('kidsFilterCountry');
        if (country) setKidsFilterCountry(country);
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    }
    loadSettings();
  }, []);

  const saveKidsFilterCountry = async (country) => {
    await window.electron?.storage?.set('kidsFilterCountry', country);
  };

  return {
    apiKey,
    setApiKey,
    kidsFilterCountry,
    setKidsFilterCountry,
    saveKidsFilterCountry,
  };
}
