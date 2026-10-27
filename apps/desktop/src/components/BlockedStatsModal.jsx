import { useEffect, useState } from 'react';
import { X, Shield } from 'lucide-react';

export default function BlockedStatsModal({
  sessionDomains,
  sessionTotal,
  alltimeTotal,
  onClose,
}) {
  const [engineStatus, setEngineStatus] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    let active = true;
    window.electron
      ?.getAdblockStatus?.()
      .then((status) => {
        if (active) setEngineStatus(status);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="blocked-modal-overlay" onClick={onClose}>
      <div className="blocked-modal" onClick={(e) => e.stopPropagation()}>
        <div className="blocked-modal-header">
          <div className="blocked-modal-title">
            <Shield className="w-4 h-4" />
            Ads &amp; Trackers Blocked
          </div>
          <button className="blocked-modal-close" onClick={onClose} title="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="blocked-modal-subtitle">
          {sessionTotal > 0
            ? `${sessionTotal} ad/tracker request${sessionTotal === 1 ? '' : 's'} blocked this session`
            : 'Start playing content to see blocked ads & trackers.'}
        </div>

        <div className="blocked-modal-list">
          {sessionDomains.length === 0 ? (
            <div className="blocked-modal-empty">
              No ads or trackers blocked yet, play something to start.
            </div>
          ) : (
            sessionDomains.map(([domain, count]) => (
              <div key={domain} className="blocked-modal-row">
                <span className="blocked-modal-domain">{domain}</span>
                <span className="blocked-modal-count">{count.toLocaleString()}</span>
              </div>
            ))
          )}
        </div>

        <div className="blocked-modal-footer">
          <Shield className="w-3 h-3" />
          All-time:&nbsp;
          <strong>
            {alltimeTotal.toLocaleString()} ad &amp; tracker request
            {alltimeTotal === 1 ? '' : 's'}
          </strong>
          &nbsp;blocked
        </div>
        {engineStatus && (
          <div className="blocked-modal-engine">
            {engineStatus.state === 'ready'
              ? `Brave adblock-rust · ${engineStatus.lists.toLocaleString()} filter lists`
              : engineStatus.state === 'error'
                ? 'Brave engine unavailable · built-in fallback protection active'
                : 'Brave engine loading · built-in fallback protection active'}
          </div>
        )}
      </div>
    </div>
  );
}
