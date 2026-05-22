import { useState } from 'react';
import { X, Check, Download } from 'lucide-react';

function SubtitleModal({ tmdbId, type, season, episode, onClose }) {
  const [subtitles, setSubtitles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubtitle, setSelectedSubtitle] = useState(null);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);

    try {
      const response = await fetch(
        `https://api.subdl.com/api/v1/subtitles?tmdb_id=${tmdbId}&type=${type}${
          season ? `&season=${season}` : ''
        }${episode ? `&episode=${episode}` : ''}&query=${encodeURIComponent(searchQuery)}`
      );
      const data = await response.json();
      setSubtitles(data.subtitles || []);
    } catch (err) {
      console.error('Failed to fetch subtitles:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (subtitle) => {
    try {
      const response = await fetch(subtitle.download_url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = subtitle.file_name || 'subtitle.srt';
      a.click();
      URL.revokeObjectURL(url);
      setSelectedSubtitle(subtitle);
    } catch (err) {
      console.error('Failed to download subtitle:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-overlay backdrop-blur-overlay z-50 flex items-center justify-center p-xl">
      <div className="relative w-full max-w-2xl bg-surface rounded-xl overflow-hidden shadow-xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-lg py-md bg-background border-b border-border">
          <h3 className="text-lg font-bold text-text-primary">Download Subtitles</h3>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-lg border-b border-border">
          <div className="flex gap-md">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by language (e.g., English, Spanish)..."
              className="input-field flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button onClick={handleSearch} className="btn-primary" disabled={loading}>
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-lg">
          {subtitles.length === 0 && !loading && (
            <div className="text-center text-text-muted py-xl">
              <p className="text-lg mb-sm">No subtitles found</p>
              <p className="text-sm">Search for subtitles by language name</p>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-xl text-text-muted">
              Searching for subtitles...
            </div>
          )}

          <div className="space-y-sm">
            {subtitles.map((subtitle) => (
              <div
                key={subtitle.id}
                className="flex items-center justify-between p-md bg-background rounded-lg border border-border"
              >
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {subtitle.language_name || subtitle.language}
                  </p>
                  <p className="text-xs text-text-muted">
                    {subtitle.format?.toUpperCase() || 'SRT'} • {subtitle.file_size || 'Unknown'}
                  </p>
                </div>
                <button
                  onClick={() => handleDownload(subtitle)}
                  className={`flex items-center gap-sm px-md py-sm rounded-button text-sm transition-colors ${
                    selectedSubtitle?.id === subtitle.id
                      ? 'bg-success text-background'
                      : 'btn-secondary'
                  }`}
                >
                  {selectedSubtitle?.id === subtitle.id ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Downloaded
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SubtitleModal;
