import { Film, Tv, Monitor, ShieldCheck, ExternalLink, Heart, Code } from 'lucide-react';

export default function AboutSettings() {
  return (
    <div className="space-y-md">
      <div className="bg-surface rounded-card border border-border overflow-hidden">
        <div className="relative p-xl flex items-center gap-xl">
          <div className="relative">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center ring-1 ring-accent/20">
              <img src="/Logo.png" alt="Nexube" className="w-16 h-16" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold text-text-primary tracking-tight">Nexube</h2>
            <p className="text-sm text-text-muted mt-xs">Version 0.1.0</p>
            <p className="text-sm text-text-muted mt-sm leading-relaxed max-w-lg">
              Browse, discover, and stream your favorite movies and TV shows
              from multiple sources — all in one place, with no account required.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-card border border-border overflow-hidden">
        <div className="divide-y divide-border/50">
          <div className="p-xl flex items-start gap-md">
            <div className="p-md rounded-xl bg-accent/10 shrink-0">
              <Film className="w-5 h-5 text-accent" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-text-primary">Movies &amp; TV Shows</h3>
              <p className="text-sm text-text-muted mt-xs leading-relaxed">
                Access thousands of movies and TV series from curated streaming sources.
                Your watch progress, favorites, and library are saved locally.
              </p>
            </div>
          </div>
          <div className="p-xl flex items-start gap-md">
            <div className="p-md rounded-xl bg-accent/10 shrink-0">
              <Monitor className="w-5 h-5 text-accent" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-text-primary">Multiple Profiles</h3>
              <p className="text-sm text-text-muted mt-xs leading-relaxed">
                Each profile has its own watch history, favorites, and personalized
                settings — including accent color, download path, and playback preferences.
              </p>
            </div>
          </div>
          <div className="p-xl flex items-start gap-md">
            <div className="p-md rounded-xl bg-accent/10 shrink-0">
              <Tv className="w-5 h-5 text-accent" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-text-primary">Anime Support</h3>
              <p className="text-sm text-text-muted mt-xs leading-relaxed">
                Automatic detection of anime content with dedicated sub and dub support.
                Built-in intro and outro skipping for supported titles.
              </p>
            </div>
          </div>
          <div className="p-xl flex items-start gap-md">
            <div className="p-md rounded-xl bg-accent/10 shrink-0">
              <ShieldCheck className="w-5 h-5 text-accent" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-text-primary">Ad-Free Experience</h3>
              <p className="text-sm text-text-muted mt-xs leading-relaxed">
                Built-in ad and tracker blocking works at the network level across all
                streaming sources — no extensions or configuration needed.
              </p>
            </div>
          </div>
        </div>
      </div>

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
    </div>
  );
}
