import { useState } from 'react';
import { Bug, Lightbulb, Gauge, RefreshCw, Radio, Palette, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { APP_VERSION } from '../../version';

const FEEDBACK_PROXY_URL = 'https://nexube-feedback-api.vercel.app/api/feedback';

const ISSUE_TYPES = [
  { value: 'Bug Report', icon: Bug, desc: 'Something is broken or not working correctly' },
  { value: 'Performance Issue', icon: Gauge, desc: 'App is slow, laggy, or consuming too many resources' },
  { value: 'Data & Sync', icon: RefreshCw, desc: 'Watch history, favorites, or downloads not syncing' },
  { value: 'Feature Request', icon: Lightbulb, desc: 'Suggest a new feature or functionality' },
  { value: 'Improvement', icon: Radio, desc: 'Enhancement to an existing feature' },
  { value: 'Design & UX', icon: Palette, desc: 'Visual design, layout, or usability concerns' },
];

export default function FeedbackReport() {
  const [issueType, setIssueType] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!issueType || !title.trim()) {
      setError('Please select an issue type and provide a title');
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const platform = await window.electron?.getPlatform?.() || 'Unknown';
      const response = await fetch(FEEDBACK_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueType,
          title: title.trim(),
          description: description.trim(),
          platform,
          appVersion: APP_VERSION,
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(body || `Server responded with ${response.status}`);
      }

      setSuccess(true);
      setTimeout(() => {
        setIssueType('');
        setTitle('');
        setDescription('');
        setSuccess(false);
      }, 3000);
    } catch (err) {
      setError(err.message || 'Failed to submit feedback. Please try again later.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full px-md py-sm bg-surface border border-border rounded-input text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 disabled:opacity-50 transition-colors";

  if (success) {
    return (
      <div className="bg-surface rounded-card border border-border p-lg text-center space-y-md">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/10 mx-auto">
          <CheckCircle className="w-8 h-8 text-accent" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-text-primary">Feedback Submitted!</h3>
          <p className="text-sm text-text-muted mt-xs">
            Thank you for helping us improve Nexube. Your feedback has been recorded.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-lg">
      <form onSubmit={handleSubmit} className="bg-surface rounded-card border border-border p-lg space-y-lg">
        <div>
          <h2 className="text-lg font-bold text-text-primary mb-md">Submit Feedback</h2>
          <p className="text-sm text-text-muted mb-md">
            Report an issue or suggest a feature. Feedback is sent directly to our GitHub repository.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-sm">Issue Type <span className="text-accent">*</span></label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
            {ISSUE_TYPES.map((type) => {
              const TypeIcon = type.icon;
              const isActive = issueType === type.value;
              return (
                <button
                key={type.value}
                type="button"
                onClick={() => setIssueType(type.value)}
                disabled={submitting}
                className={`flex items-center gap-sm p-md rounded-input border text-left transition-all ${
                  isActive
                    ? 'border-accent bg-accent/5'
                    : 'border-border bg-transparent hover:border-border/80'
                } disabled:opacity-50`}
              >
                <div className={`p-sm rounded-lg shrink-0 ${isActive ? 'bg-accent/10' : 'bg-surface'}`}>
                  <TypeIcon className={`w-4 h-4 ${isActive ? 'text-accent' : 'text-text-muted'}`} />
                </div>
                <div className="min-w-0">
                  <div className={`text-sm font-medium ${isActive ? 'text-accent' : 'text-text-primary'}`}>
                    {type.label}
                  </div>
                  <div className="text-xs text-text-muted mt-0.5 leading-snug">{type.desc}</div>
                </div>
              </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-sm">Title <span className="text-accent">*</span></label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Brief summary of the issue or feature request"
            disabled={submitting}
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-sm">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detailed explanation, steps to reproduce, expected behavior..."
            rows={5}
            disabled={submitting}
            className={`${inputClass} resize-y min-h-[120px]`}
          />
        </div>

        <div className="bg-surface border border-border rounded-input p-md">
          <p className="text-xs text-text-muted leading-relaxed">
            Your OS and app version are automatically attached. No personal data is collected without your consent.
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-sm p-md bg-danger/5 border border-danger/20 rounded-input">
            <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting || !issueType || !title.trim()}
            className="btn-primary inline-flex items-center gap-sm"
          >
            {submitting ? (
              <>
                <Send className="w-4 h-4 animate-pulse" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Submit Feedback
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
