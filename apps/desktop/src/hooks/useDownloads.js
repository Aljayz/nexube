import { useState, useEffect, useCallback } from 'react';

export function useDownloads(profileId) {
  const [downloads, setDownloads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDownloads = useCallback(async () => {
    if (!profileId) return;
    try {
      const result = await window.electron?.downloads?.list(profileId);
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
    const interval = setInterval(() => {
      const hasActive = downloads.some((d) => d.status === 'downloading');
      if (hasActive && window.electron?.downloads) {
        window.electron.downloads.getActive(profileId).then((result) => {
          if (Array.isArray(result)) {
            const normalized = result.map((d) => ({
              ...d,
              progress: d.progress_percent ?? d.progress ?? 0,
            }));
            setDownloads((prev) => {
              const merged = [...prev];
              for (const fresh of normalized) {
                const idx = merged.findIndex((d) => d.id === fresh.id);
                if (idx === -1) {
                  merged.push(fresh);
                } else {
                  merged[idx] = { ...merged[idx], ...fresh };
                }
              }
              return merged;
            });
          }
        });
      }
    }, 500);
    return () => clearInterval(interval);
  }, [downloads, profileId]);

  useEffect(() => {
    if (!window.electron?.downloads) return;

    const progressHandler = window.electron.downloads.onProgress((data) => {
      setDownloads((prev) => {
        const idx = prev.findIndex((d) => d.id === data.id);
        const updated = [...prev];
        const entry = {
          id: data.id,
          progress: 0,
          status: 'downloading',
          lastMessage: 'Starting…',
        };

        if (idx === -1) {
          updated.push({ ...entry, ...data });
        } else {
          updated[idx] = { ...updated[idx], ...data };
        }
        return updated;
      });
    });

    return () => {
      window.electron?.downloads?.offProgress(progressHandler);
    };
  }, []);

  const startDownload = useCallback(async (params) => {
    const result = await window.electron?.downloads?.start({
      ...params,
      profileId,
    });
    if (result?.success) {
      fetchDownloads();
    }
    return result;
  }, [profileId, fetchDownloads]);

  const cancelDownload = useCallback(async (id) => {
    const result = await window.electron?.downloads?.stop(id);
    if (result?.success) {
      setDownloads((prev) => prev.map((d) => d.id !== id ? d : { ...d, status: 'cancelled', error: 'Stopped by user' }));
    }
    return result;
  }, []);

  const deleteDownload = useCallback(async (id) => {
    const result = await window.electron?.downloads?.delete(id);
    if (result?.success) {
      setDownloads((prev) => prev.filter((d) => d.id !== id));
    }
    return result;
  }, []);

  const playDownload = useCallback(async (id) => {
    return await window.electron?.downloads?.play(id);
  }, []);

  const stopAllDownloads = useCallback(async () => {
    const result = await window.electron?.downloads?.killAll();
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
    deleteDownload,
    playDownload,
    stopAllDownloads,
    refreshDownloads: fetchDownloads,
  };
}
