import { useState, useEffect } from 'react';
import { X, Sparkles, Loader2, AlertCircle } from 'lucide-react';

function renderMarkdown(text) {
  if (!text) return '';
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/### (.+)/g, '<h3 class="text-sm font-bold text-text-primary mt-lg mb-sm">$1</h3>')
    .replace(/## (.+)/g, '<h2 class="text-base font-bold text-text-primary mt-xl mb-sm">$1</h2>')
    .replace(/# (.+)/g, '<h1 class="text-lg font-bold text-text-primary mt-xl mb-md">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-text-primary">$1</strong>')
    .replace(/\n\* (.+)/g, '<li class="text-sm text-text-muted ml-md list-disc">$1</li>')
    .replace(/\n- (.+)/g, '<li class="text-sm text-text-muted ml-md list-disc">$1</li>')
    .replace(/\n\n/g, '</p><p class="text-sm text-text-muted mb-sm">')
    .replace(/\n/g, '<br/>');
  return `<p class="text-sm text-text-muted mb-sm">${html}</p>`;
}

export default function WhatsNewModal({ version, onClose }) {
  const [notes, setNotes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    window.electron?.update?.getReleaseNotes?.(version).then((result) => {
      if (!mounted) return;
      if (result?.success && result.body) {
        setNotes(result.body);
      } else {
        setError(true);
      }
      setLoading(false);
    }).catch(() => {
      if (!mounted) return;
      setError(true);
      setLoading(false);
    });
    return () => { mounted = false; };
  }, [version]);

  const handleContinue = async () => {
    await window.electron?.update?.storeVersion?.(version);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-overlay backdrop-blur-overlay z-50 flex items-center justify-center p-xl">
      <div className="relative w-full max-w-lg bg-surface rounded-xl overflow-hidden shadow-xl border border-border max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-lg py-md border-b border-border shrink-0">
          <div className="flex items-center gap-sm">
            <Sparkles className="w-5 h-5 text-accent" />
            <h3 className="text-lg font-bold text-text-primary">What's New in v{version}</h3>
          </div>
          <button onClick={handleContinue} className="text-text-muted hover:text-text-primary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-lg">
          {loading && (
            <div className="flex items-center gap-sm text-sm text-text-muted">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading release notes...
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-sm text-sm text-text-muted py-lg">
              <AlertCircle className="w-8 h-8 text-text-muted" />
              <p>Could not load release notes.</p>
              <a
                href={`https://github.com/Aljayz/nexube/releases/tag/v${version}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                View on GitHub →
              </a>
            </div>
          )}

          {notes && (
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(notes) }}
            />
          )}
        </div>

        <div className="px-lg py-md border-t border-border shrink-0 flex justify-end">
          <button onClick={handleContinue} className="btn-primary">
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
