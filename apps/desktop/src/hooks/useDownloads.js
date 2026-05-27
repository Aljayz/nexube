import { useState, useEffect, useCallback } from 'react';

export function useDownloads(profileId) {
  const [downloads, setDownloads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDownloads = useCallback(async () => {
    if (!profileId) return;
    try {
      const result = await window.electron?.deskDownloads?.list(profileId);
      if (Array.isArray(result)) {
        const normalized = result.map((d) => ({
          ...d,
          progress: d.progress_percent ?? d.progress ?? 0,
        }));
        setDownloads((prev) => {
          const merged = [...normalized];
          for (const existing of prev) {
            if (!merged.find((d) => d.id === existing.id)) {
              merged.push(existing);
            }
          }
          return merged;
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    fetchDownloads();
  }, [fetchDownloads]);

  useEffect(() => {
    const hasActive = () => downloads.some((d) => d.status === 'downloading');

    const fast = setInterval(() => {
      if (hasActive() && window.electron?.deskDownloads) {
        window.electron.deskDownloads.getActive(profileId).then((result) => {
          if (Array.isArray(result)) {
            const normalized = result.map((d) => ({
              ...d,
              progress: d.progress_percent ?? d.progress ?? 0,
            }));
            setDownloads((prev) => {
              const terminalStates = ['completed', 'error', 'stopped', 'cancelled'];
              const merged = [...prev];
              for (const fresh of normalized) {
                const idx = merged.findIndex((d) => d.id === fresh.id);
                if (idx === -1) {
                  merged.push(fresh);
                } else if (!terminalStates.includes(merged[idx].status)) {
                  merged[idx] = { ...merged[idx], ...fresh };
                }
              }
              return merged;
            });
          }
        });
      }
    }, 500);

    const slow = setInterval(() => {
      if (hasActive()) {
        fetchDownloads();
      }
    }, 3000);

    return () => {
      clearInterval(fast);
      clearInterval(slow);
    };
  }, [downloads, profileId, fetchDownloads]);

  useEffect(() => {
    if (!window.electron?.deskDownloads) return;

    const progressHandler = window.electron.deskDownloads.onProgress((data) => {
      setDownloads((prev) => {
        const idx = prev.findIndex((d) => d.id === data.id);
        const updated = [...prev];
        const progressVal = data.progress ?? data.pct ?? 0;
        const entry = {
          id: data.id,
          progress: progressVal,
          status: 'downloading',
          lastMessage: 'Starting…',
        };

        if (idx === -1) {
          updated.push({ ...entry, ...data, progress: progressVal });
        } else {
          const terminalStates = ['completed', 'error', 'stopped', 'cancelled'];
          if (!terminalStates.includes(updated[idx].status)) {
            const merged = { ...updated[idx], ...data, progress: progressVal };
            if (updated[idx].total_bytes) {
              merged.total_bytes = updated[idx].total_bytes;
            }
            updated[idx] = merged;
          }
        }
        return updated;
      });
    });

    return () => {
      window.electron?.deskDownloads?.offProgress(progressHandler);
    };
  }, []);

  const startDownload = useCallback(async (params) => {
    const result = await window.electron?.deskDownloads?.queue({
      ...params,
      profileId,
    });
    if (result?.success) {
      fetchDownloads();
    }
    return result;
  }, [profileId, fetchDownloads]);

  const cancelDownload = useCallback(async (id) => {
    const result = await window.electron?.deskDownloads?.stop(id);
    if (result?.success) {
      setDownloads((prev) => prev.map((d) => d.id !== id ? d : { ...d, status: 'cancelled', error: 'Stopped by user' }));
      fetchDownloads();
    }
    return result;
  }, [fetchDownloads]);

  const pauseDownload = useCallback(async (id) => {
    const result = await window.electron?.deskDownloads?.pause(id);
    if (result?.success) {
      setDownloads((prev) => prev.map((d) => d.id !== id ? d : { ...d, status: 'paused', lastMessage: 'Paused' }));
    }
    return result;
  }, []);

  const resumeDownload = useCallback(async (id) => {
    const result = await window.electron?.deskDownloads?.resume(id);
    if (result?.success) {
      setDownloads((prev) => prev.map((d) => d.id !== id ? d : { ...d, status: 'downloading', lastMessage: 'Resumed' }));
    }
    return result;
  }, []);

  const deleteDownload = useCallback(async (id) => {
    const result = await window.electron?.deskDownloads?.delete(id);
    if (result?.success) {
      setDownloads((prev) => prev.filter((d) => d.id !== id));
    }
    return result;
  }, []);

  const playDownload = useCallback(async (id) => {
    return await window.electron?.deskDownloads?.play(id);
  }, []);

  const stopAllDownloads = useCallback(async () => {
    const result = await window.electron?.deskDownloads?.killAll();
    if (result?.success) {
      setDownloads((prev) => prev.map((d) => d.status !== 'downloading' ? d : { ...d, status: 'cancelled', error: 'Stopped by user' }));
    }
    return result;
  }, []);

  return {
    downloads,
    setDownloads,
    loading,
    error,
    startDownload,
    cancelDownload,
    pauseDownload,
    resumeDownload,
    deleteDownload,
    playDownload,
    stopAllDownloads,
    refreshDownloads: fetchDownloads,
  };
}
