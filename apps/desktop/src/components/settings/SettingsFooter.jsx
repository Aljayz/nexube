import { ExternalLink, Heart, Code } from 'lucide-react';

export default function SettingsFooter() {
  return (
    <div className="bg-surface rounded-card p-xl border border-border space-y-md">
      <p className="text-xs text-text-muted text-center leading-relaxed">
        This product uses the TMDB API but is not endorsed or certified by{' '}
        <a
          href="https://www.themoviedb.org"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline inline-flex items-center gap-1"
        >
          The Movie Database (TMDB)
          <ExternalLink className="w-3 h-3" />
        </a>
        .
      </p>

      <div className="flex items-center justify-center gap-xl pt-sm border-t border-border/50">
        <div className="flex items-center gap-sm text-sm text-text-muted">
          <Code className="w-4 h-4" />
          <span>
            Built by{' '}
            <a
              href="https://aljayz.github.io/portfolio/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              Aljayz
            </a>
          </span>
        </div>
        <div className="flex items-center gap-sm text-sm text-text-muted">
          <Heart className="w-4 h-4" />
          <span>
            Inspired by{' '}
            <a
              href="https://github.com/truelockmc"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              truelockmc
            </a>
            's Streambert
          </span>
        </div>
      </div>
    </div>
  );
}
