import { useState, useEffect, useRef, useCallback } from 'react';

export function useBlockedStats(resetKey) {
  const [sessionTotal, setSessionTotal] = useState(0);
  const sessionDomainsRef = useRef({});
  const [alltimeTotal, setAlltimeTotal] = useState(0);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!window.electron?.getBlockStats) return;
    let mounted = true;
    window.electron.getBlockStats().then((stats) => {
      if (mounted && stats) setAlltimeTotal(stats.total || 0);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    setSessionTotal(0);
    sessionDomainsRef.current = {};
  }, [resetKey]);

  useEffect(() => {
    if (!window.electron?.onBlockedUpdate) return;
    const handler = window.electron.onBlockedUpdate((data) => {
      if (!data) return;
      setAlltimeTotal((prev) => prev + (data.total || 0));
      setSessionTotal((prev) => prev + (data.total || 0));
      const map = sessionDomainsRef.current;
      for (const [domain, count] of Object.entries(data.domains || {})) {
        map[domain] = (map[domain] || 0) + count;
      }
    });
    return () => {
      if (window.electron?.offBlockedUpdate)
        window.electron.offBlockedUpdate(handler);
    };
  }, []);

  const getSessionDomains = useCallback(
    () => Object.entries(sessionDomainsRef.current).sort((a, b) => b[1] - a[1]),
    [],
  );

  return {
    sessionTotal,
    alltimeTotal,
    showModal,
    setShowModal,
    getSessionDomains,
  };
}
