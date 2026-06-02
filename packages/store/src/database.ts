import Database from 'better-sqlite3';
import path from 'path';
import { Profile, MAX_STANDARD_PROFILES, ProfileGuardrailResult } from '@nexube/types';

const SCHEMA_VERSION = 1;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    is_kids BOOLEAN NOT NULL DEFAULT 0,
    is_master BOOLEAN NOT NULL DEFAULT 0,
    pin_hash TEXT,
    password_hash TEXT,
    security_type TEXT CHECK(security_type IN ('pin', 'password')),
    avatar_color TEXT DEFAULT '#00E5FF',
    avatar TEXT,
    download_path TEXT,
    preferred_source TEXT DEFAULT 'videasy',
    auto_mark_threshold INTEGER DEFAULT 20
  );

  CREATE TABLE IF NOT EXISTS global_media (
    id TEXT PRIMARY KEY,
    tmdb_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    type TEXT CHECK(type IN ('movie', 'tv')) NOT NULL,
    poster_path TEXT,
    backdrop_path TEXT,
    overview TEXT,
    release_date TEXT,
    vote_average REAL,
    vote_count INTEGER,
    popularity REAL,
    original_language TEXT,
    genres TEXT,
    runtime INTEGER,
    number_of_seasons INTEGER,
    number_of_episodes INTEGER,
    status TEXT,
    tagline TEXT,
    is_anime BOOLEAN NOT NULL DEFAULT 0,
    cached_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_favorites (
    profile_id TEXT NOT NULL,
    media_id TEXT NOT NULL,
    added_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (profile_id, media_id),
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (media_id) REFERENCES global_media(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_saved (
    profile_id TEXT NOT NULL,
    media_id TEXT NOT NULL,
    added_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (profile_id, media_id),
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (media_id) REFERENCES global_media(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS watch_progress (
    profile_id TEXT NOT NULL,
    media_id TEXT NOT NULL,
    progress_percent REAL NOT NULL DEFAULT 0,
    progress_seconds REAL NOT NULL DEFAULT 0,
    duration REAL NOT NULL DEFAULT 0,
    last_watched TEXT NOT NULL DEFAULT (datetime('now')),
    season INTEGER,
    episode INTEGER,
    PRIMARY KEY (profile_id, media_id),
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (media_id) REFERENCES global_media(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS watch_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id TEXT NOT NULL,
    media_id TEXT NOT NULL,
    title TEXT NOT NULL,
    poster_path TEXT,
    completed_at TEXT NOT NULL DEFAULT (datetime('now')),
    season INTEGER,
    episode INTEGER,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (media_id) REFERENCES global_media(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS downloads (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    media_id TEXT NOT NULL,
    file_path TEXT,
    vault_path TEXT,
    quality TEXT,
    size INTEGER DEFAULT 0,
    status TEXT DEFAULT 'queued',
    progress_percent REAL DEFAULT 0,
    progress_bytes INTEGER DEFAULT 0,
    total_bytes INTEGER,
    speed TEXT,
    error TEXT,
    m3u8_url TEXT,
    referer TEXT,
    cookies TEXT,
    download_path TEXT,
    process_id INTEGER,
    started_at TEXT,
    completed_at TEXT,
    added_at TEXT NOT NULL DEFAULT (datetime('now')),
    season INTEGER,
    episode INTEGER,
    source_id TEXT,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (media_id) REFERENCES global_media(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_global_media_tmdb_id ON global_media(tmdb_id);
  CREATE INDEX IF NOT EXISTS idx_global_media_type ON global_media(type);
  CREATE INDEX IF NOT EXISTS idx_global_media_is_anime ON global_media(is_anime);
  CREATE INDEX IF NOT EXISTS idx_user_favorites_profile ON user_favorites(profile_id);
  CREATE INDEX IF NOT EXISTS idx_user_saved_profile ON user_saved(profile_id);
  CREATE INDEX IF NOT EXISTS idx_watch_progress_profile ON watch_progress(profile_id);
  CREATE INDEX IF NOT EXISTS idx_watch_history_profile ON watch_history(profile_id);
  CREATE INDEX IF NOT EXISTS idx_watch_history_completed ON watch_history(completed_at DESC);
  CREATE INDEX IF NOT EXISTS idx_downloads_profile ON downloads(profile_id);
  CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status);
  CREATE INDEX IF NOT EXISTS idx_downloads_media ON downloads(media_id);

  CREATE TABLE IF NOT EXISTS batches (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('season','collection')),
    media_id TEXT,
    season INTEGER,
    collection_id INTEGER,
    total INTEGER NOT NULL DEFAULT 0,
    completed INTEGER NOT NULL DEFAULT 0,
    failed INTEGER NOT NULL DEFAULT 0,
    skipped INTEGER NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'queuing',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_batches_profile ON batches(profile_id);
`;

const SEED_PROFILES: Profile[] = [
  {
    id: 'master-id',
    name: 'Master Account',
    isKids: false,
    isMaster: true,
    pinHash: null,
    passwordHash: null,
    securityType: null,
    avatarColor: '#00E5FF',
    avatar: null,
  },
  {
    id: 'kids-id',
    name: 'Kids Account',
    isKids: true,
    isMaster: false,
    pinHash: null,
    passwordHash: null,
    securityType: null,
    avatarColor: '#2ED573',
    avatar: null,
  },
];

let db: Database.Database | null = null;

export function getDatabase(dbPath?: string): Database.Database {
  if (db) return db;

  const resolvedPath = dbPath || path.join(process.cwd(), 'nexube.db');
  db = new Database(resolvedPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('cache_size = -64000');
  db.pragma('synchronous = NORMAL');

  db.exec(SCHEMA);

  migrateDatabase();

  seedDatabase();

  return db;
}

function seedDatabase(): void {
  const existingCount = db!.prepare('SELECT COUNT(*) as count FROM profiles').get() as { count: number };

  if (existingCount.count === 0) {
    const insert = db!.prepare(
      'INSERT INTO profiles (id, name, is_kids, is_master, pin_hash, avatar_color) VALUES (?, ?, ?, ?, ?, ?)'
    );

    const transaction = db!.transaction((profiles: Profile[]) => {
      for (const profile of profiles) {
        insert.run(
          profile.id,
          profile.name,
          profile.isKids ? 1 : 0,
          profile.isMaster ? 1 : 0,
          profile.pinHash,
          profile.avatarColor || '#00E5FF'
        );
      }
    });

    transaction(SEED_PROFILES);
  }
}

function migrateDatabase(): void {
  try {
    const profileColumns = db!.prepare("PRAGMA table_info(profiles)").all() as any[];
    const profileNames = profileColumns.map((c) => c.name);

    if (!profileNames.includes('password_hash')) {
      db!.exec('ALTER TABLE profiles ADD COLUMN password_hash TEXT');
    }
    if (!profileNames.includes('security_type')) {
      db!.exec("ALTER TABLE profiles ADD COLUMN security_type TEXT CHECK(security_type IN ('pin', 'password'))");
    }

    try {
      db!.exec('ALTER TABLE downloads ADD COLUMN download_path TEXT');
    } catch {}
    try {
      db!.exec('ALTER TABLE downloads ADD COLUMN title TEXT');
    } catch {}
    try {
      db!.exec('ALTER TABLE downloads ADD COLUMN process_id INTEGER');
    } catch {}
    try {
      db!.exec('ALTER TABLE downloads ADD COLUMN episode_name TEXT');
    } catch {}
    try {
      db!.exec('ALTER TABLE downloads ADD COLUMN collection_id INTEGER');
    } catch {}
    try {
      db!.exec('ALTER TABLE profiles ADD COLUMN avatar TEXT');
    } catch {}
    try {
      db!.exec("ALTER TABLE profiles ADD COLUMN accent_color TEXT DEFAULT '#00E5FF'");
    } catch {}
    try {
      db!.exec('ALTER TABLE profiles ADD COLUMN download_path TEXT');
    } catch {}
    try {
      db!.exec("ALTER TABLE profiles ADD COLUMN preferred_source TEXT DEFAULT 'videasy'");
    } catch {}
    try {
      db!.exec('ALTER TABLE profiles ADD COLUMN auto_mark_threshold INTEGER DEFAULT 20');
    } catch {}
    try {
      db!.exec("DELETE FROM app_settings WHERE key = 'preferredSource' OR key = 'autoMarkThreshold'");
    } catch {}
    try {
      db!.exec('ALTER TABLE downloads ADD COLUMN batch_id TEXT');
    } catch {}
    try {
      db!.exec('ALTER TABLE downloads ADD COLUMN vault_path TEXT');
    } catch {}
    try {
      db!.exec('ALTER TABLE downloads ADD COLUMN remux_path TEXT');
    } catch {}
    try {
      db!.exec('ALTER TABLE downloads ADD COLUMN subtitles_path TEXT');
    } catch {}
    try {
      db!.exec("ALTER TABLE downloads ADD COLUMN fetch_subtitles INTEGER DEFAULT 1");
    } catch {}
    try {
      db!.exec("ALTER TABLE downloads ADD COLUMN watched_position INTEGER DEFAULT 0");
    } catch {}
    try {
      db!.exec("ALTER TABLE downloads ADD COLUMN finished INTEGER DEFAULT 0");
    } catch {}

    try {
      const ddl = db!.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='downloads'").get() as { sql: string } | undefined;
      if (ddl && ddl.sql && ddl.sql.includes('CHECK')) {
        const cols = (db!.prepare("PRAGMA table_info(downloads)").all() as any[]).map((c: any) => `"${c.name}"`);
        db!.exec(`
          CREATE TABLE downloads_new (${cols.join(', ')});
          INSERT INTO downloads_new SELECT * FROM downloads;
          DROP TABLE downloads;
          ALTER TABLE downloads_new RENAME TO downloads;
        `);
      }
    } catch {}

    try {
      db!.exec("ALTER TABLE batches ADD COLUMN status TEXT DEFAULT 'queuing'");
    } catch {}

    try {
      const bddl = db!.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='batches'").get() as { sql: string } | undefined;
      if (bddl && bddl.sql && bddl.sql.includes('queuing')) {
        // Recreate batches table with updated status CHECK values
        const cols = (db!.prepare("PRAGMA table_info(batches)").all() as any[]).map((c: any) => `"${c.name}"`);
        db!.exec(`
          CREATE TABLE batches_new (${cols.join(', ')});
          INSERT INTO batches_new SELECT * FROM batches;
          DROP TABLE batches;
          ALTER TABLE batches_new RENAME TO batches;
        `);
      }
    } catch {}
  } catch (err) {
    console.error('Migration error:', err);
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function getProfiles(): Profile[] {
  const rows = db!.prepare('SELECT * FROM profiles ORDER BY is_master DESC, is_kids ASC, name ASC').all();
  return rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    isKids: row.is_kids === 1,
    isMaster: row.is_master === 1,
    pinHash: row.pin_hash,
    passwordHash: row.password_hash,
    securityType: row.security_type,
    avatarColor: row.avatar_color,
    avatar: row.avatar || null,
    accentColor: row.accent_color || null,
    preferredSource: row.preferred_source || 'videasy',
    autoMarkThreshold: row.auto_mark_threshold != null ? row.auto_mark_threshold : 20,
  }));
}

export function getProfile(id: string): Profile | null {
  const row = db!.prepare('SELECT * FROM profiles WHERE id = ?').get(id) as any;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    isKids: row.is_kids === 1,
    isMaster: row.is_master === 1,
    pinHash: row.pin_hash,
    passwordHash: row.password_hash,
    securityType: row.security_type,
    avatarColor: row.avatar_color,
    avatar: row.avatar || null,
    accentColor: row.accent_color || null,
    preferredSource: row.preferred_source || 'videasy',
    autoMarkThreshold: row.auto_mark_threshold != null ? row.auto_mark_threshold : 20,
  };
}

export function createProfile(input: { name: string; isKids: boolean; pinHash?: string | null; isMaster?: boolean; password?: string | null; securityType?: 'pin' | 'password' | null; avatar?: string | null; accentColor?: string | null; preferredSource?: string | null; autoMarkThreshold?: number | null }): Profile {
  if (!input.isMaster) {
    const guardrail = checkProfileGuardrail(input.isKids);
    if (!guardrail.allowed) {
      throw new Error(guardrail.error);
    }
  }

  const id = input.isMaster ? 'master-id' : `profile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const avatarColors = ['#00E5FF', '#2ED573', '#FFA502', '#FF4757', '#A855F7', '#EC4899'];
  const avatarColor = avatarColors[Math.floor(Math.random() * avatarColors.length)];
  const builtInAvatars = ['/avatar1.png', '/avatar2.png', '/avatar3.png', '/avatar4.png', '/avatar5.png', '/avatar6.png'];
  const avatar = input.avatar || builtInAvatars[Math.floor(Math.random() * builtInAvatars.length)];

  const accentColor = input.accentColor || '#00E5FF';

  const preferredSource = input.preferredSource || 'videasy';
  const autoMarkThreshold = input.autoMarkThreshold != null ? input.autoMarkThreshold : 20;

  db!.prepare(
    'INSERT OR REPLACE INTO profiles (id, name, is_kids, is_master, pin_hash, password_hash, security_type, avatar_color, avatar, accent_color, preferred_source, auto_mark_threshold) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, input.name, input.isKids ? 1 : 0, input.isMaster ? 1 : 0, input.pinHash || null, input.password || null, input.securityType || null, avatarColor, avatar, accentColor, preferredSource, autoMarkThreshold);

  return {
    id,
    name: input.name,
    isKids: input.isKids,
    isMaster: input.isMaster || false,
    pinHash: input.pinHash || null,
    passwordHash: input.password || null,
    securityType: input.securityType || null,
    avatarColor,
    avatar,
    accentColor,
    preferredSource,
    autoMarkThreshold,
  };
}

export function updateProfile(id: string, updates: Partial<Profile>): void {
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.isKids !== undefined) {
    fields.push('is_kids = ?');
    values.push(updates.isKids ? 1 : 0);
  }
  if (updates.pinHash !== undefined) {
    fields.push('pin_hash = ?');
    values.push(updates.pinHash);
  }
  if (updates.avatarColor !== undefined) {
    fields.push('avatar_color = ?');
    values.push(updates.avatarColor);
  }
  if (updates.avatar !== undefined) {
    fields.push('avatar = ?');
    values.push(updates.avatar);
  }
  if (updates.accentColor !== undefined) {
    fields.push('accent_color = ?');
    values.push(updates.accentColor);
  }
  if (updates.preferredSource !== undefined) {
    fields.push('preferred_source = ?');
    values.push(updates.preferredSource);
  }
  if (updates.autoMarkThreshold !== undefined) {
    fields.push('auto_mark_threshold = ?');
    values.push(updates.autoMarkThreshold);
  }

  if (fields.length === 0) return;

  values.push(id);
  db!.prepare(`UPDATE profiles SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteProfile(id: string): void {
  const profile = getProfile(id);
  if (!profile) throw new Error('Profile not found');
  if (profile.isMaster) throw new Error('Cannot delete master account');

  db!.prepare('DELETE FROM profiles WHERE id = ?').run(id);
}

export function checkProfileGuardrail(isKids: boolean): ProfileGuardrailResult {
  if (isKids) {
    return { allowed: true, currentCount: 0 };
  }

  const result = db!.prepare(
    'SELECT COUNT(*) as count FROM profiles WHERE is_kids = 0 AND is_master = 0'
  ).get() as { count: number };

  if (result.count >= MAX_STANDARD_PROFILES) {
    return {
      allowed: false,
      error: `Maximum of ${MAX_STANDARD_PROFILES} standard profiles reached. Delete an existing profile to create a new one.`,
      currentCount: result.count,
    };
  }

  return { allowed: true, currentCount: result.count };
}

export function upsertMedia(media: {
  id: string;
  tmdbId: number;
  title: string;
  type: 'movie' | 'tv';
  posterPath: string | null;
  backdropPath: string | null;
  overview: string;
  releaseDate: string;
  voteAverage: number;
  voteCount: number;
  popularity: number;
  originalLanguage: string;
  genres: string;
  runtime?: number;
  numberOfSeasons?: number;
  numberOfEpisodes?: number;
  status?: string;
  tagline?: string;
  isAnime: boolean;
}): void {
  db!.prepare(
    `INSERT INTO global_media (
      id, tmdb_id, title, type, poster_path, backdrop_path, overview,
      release_date, vote_average, vote_count, popularity, original_language,
      genres, runtime, number_of_seasons, number_of_episodes, status, tagline, is_anime, cached_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      poster_path = excluded.poster_path,
      backdrop_path = excluded.backdrop_path,
      overview = excluded.overview,
      release_date = excluded.release_date,
      vote_average = excluded.vote_average,
      vote_count = excluded.vote_count,
      popularity = excluded.popularity,
      original_language = excluded.original_language,
      genres = excluded.genres,
      runtime = excluded.runtime,
      number_of_seasons = excluded.number_of_seasons,
      number_of_episodes = excluded.number_of_episodes,
      status = excluded.status,
      tagline = excluded.tagline,
      is_anime = excluded.is_anime,
      cached_at = datetime('now')`
  ).run(
    media.id,
    media.tmdbId,
    media.title,
    media.type,
    media.posterPath,
    media.backdropPath,
    media.overview,
    media.releaseDate,
    media.voteAverage,
    media.voteCount,
    media.popularity,
    media.originalLanguage,
    media.genres,
    media.runtime || null,
    media.numberOfSeasons || null,
    media.numberOfEpisodes || null,
    media.status || null,
    media.tagline || null,
    media.isAnime ? 1 : 0
  );
}

export function addFavorite(profileId: string, mediaId: string): void {
  db!.prepare(
    'INSERT OR IGNORE INTO user_favorites (profile_id, media_id) VALUES (?, ?)'
  ).run(profileId, mediaId);
}

export function removeFavorite(profileId: string, mediaId: string): void {
  db!.prepare(
    'DELETE FROM user_favorites WHERE profile_id = ? AND media_id = ?'
  ).run(profileId, mediaId);
}

export function getFavorites(profileId: string): any[] {
  return db!.prepare(
    `SELECT gm.*, uf.added_at FROM user_favorites uf
     INNER JOIN global_media gm ON uf.media_id = gm.id
     WHERE uf.profile_id = ?
     ORDER BY uf.added_at DESC`
  ).all(profileId);
}

export function isFavorite(profileId: string, mediaId: string): boolean {
  const row = db!.prepare(
    'SELECT 1 FROM user_favorites WHERE profile_id = ? AND media_id = ?'
  ).get(profileId, mediaId);
  return !!row;
}

export function addSaved(profileId: string, mediaId: string): void {
  db!.prepare(
    'INSERT OR IGNORE INTO user_saved (profile_id, media_id) VALUES (?, ?)'
  ).run(profileId, mediaId);
}

export function removeSaved(profileId: string, mediaId: string): void {
  db!.prepare(
    'DELETE FROM user_saved WHERE profile_id = ? AND media_id = ?'
  ).run(profileId, mediaId);
}

export function getSaved(profileId: string): any[] {
  return db!.prepare(
    `SELECT gm.*, us.added_at FROM user_saved us
     INNER JOIN global_media gm ON us.media_id = gm.id
     WHERE us.profile_id = ?
     ORDER BY us.added_at DESC`
  ).all(profileId);
}

export function isSaved(profileId: string, mediaId: string): boolean {
  const row = db!.prepare(
    'SELECT 1 FROM user_saved WHERE profile_id = ? AND media_id = ?'
  ).get(profileId, mediaId);
  return !!row;
}

export function updateWatchProgress(
  profileId: string,
  mediaId: string,
  progress: {
    progressPercent: number;
    progressSeconds: number;
    duration: number;
    season?: number;
    episode?: number;
  }
): void {
  db!.prepare(
    `INSERT INTO watch_progress (profile_id, media_id, progress_percent, progress_seconds, duration, season, episode)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(profile_id, media_id) DO UPDATE SET
       progress_percent = excluded.progress_percent,
       progress_seconds = excluded.progress_seconds,
       duration = excluded.duration,
       last_watched = datetime('now'),
       season = excluded.season,
       episode = excluded.episode`
  ).run(
    profileId,
    mediaId,
    progress.progressPercent,
    progress.progressSeconds,
    progress.duration,
    progress.season || null,
    progress.episode || null
  );
}

export function getWatchProgress(profileId: string, mediaId: string): any | null {
  return db!.prepare(
    'SELECT * FROM watch_progress WHERE profile_id = ? AND media_id = ?'
  ).get(profileId, mediaId) || null;
}

export function getContinueWatching(profileId: string): any[] {
  return db!.prepare(
    `SELECT gm.*, wp.progress_percent, wp.progress_seconds, wp.duration, wp.last_watched, wp.season, wp.episode
     FROM watch_progress wp
     INNER JOIN global_media gm ON wp.media_id = gm.id
     WHERE wp.profile_id = ? AND wp.progress_percent > 0 AND wp.progress_percent < 95
     ORDER BY wp.last_watched DESC
     LIMIT 20`
  ).all(profileId);
}

export function addWatchHistory(
  profileId: string,
  mediaId: string,
  title: string,
  posterPath: string | null,
  season?: number,
  episode?: number
): void {
  db!.prepare(
    `INSERT INTO watch_history (profile_id, media_id, title, poster_path, season, episode)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(profileId, mediaId, title, posterPath, season || null, episode || null);
}

export function getWatchHistory(profileId: string): any[] {
  return db!.prepare(
    `SELECT * FROM watch_history
     WHERE profile_id = ?
     ORDER BY completed_at DESC
     LIMIT 50`
  ).all(profileId);
}

export function getSetting(key: string): string | null {
  const row = db!.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as any;
  return row ? row.value : null;
}

export function setSetting(key: string, value: string): void {
  db!.prepare(
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, value);
}

export function setActiveProfileId(id: string): void {
  setSetting('activeProfileId', id);
}

export function getActiveProfileId(): string | null {
  return getSetting('activeProfileId');
}

export function verifyPin(id: string, pin: string): boolean {
  const profile = getProfile(id);
  if (!profile || !profile.pinHash) return false;
  return profile.pinHash === pin;
}

export function verifyPassword(id: string, password: string): boolean {
  const row = db!.prepare('SELECT password_hash FROM profiles WHERE id = ?').get(id) as any;
  if (!row || !row.password_hash) return false;
  return row.password_hash === password;
}

export function updateProfileSecurity(id: string, securityType: 'pin' | 'password' | null, secret: string | null): void {
  db!.prepare(
    'UPDATE profiles SET security_type = ?, pin_hash = CASE WHEN ? = \'pin\' THEN ? ELSE pin_hash END, password_hash = CASE WHEN ? = \'password\' THEN ? ELSE password_hash END WHERE id = ?'
  ).run(securityType, securityType, secret, securityType, secret, id);
}

export function addDownload(download: {
  id: string;
  profileId: string;
  mediaId: string;
  quality?: string;
  m3u8Url?: string;
  referer?: string;
  cookies?: string;
  downloadPath?: string;
  season?: number;
  episode?: number;
  episodeName?: string;
  sourceId?: string;
  collectionId?: number;
  batchId?: string;
  status?: string;
  fetchSubtitles?: boolean;
}): void {
  db!.prepare(
    `INSERT INTO downloads (id, profile_id, media_id, quality, m3u8_url, referer, cookies, download_path, season, episode, episode_name, source_id, collection_id, batch_id, status, fetch_subtitles)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    download.id,
    download.profileId,
    download.mediaId,
    download.quality || null,
    download.m3u8Url || null,
    download.referer || null,
    download.cookies || null,
    download.downloadPath || null,
    download.season || null,
    download.episode || null,
    download.episodeName || null,
    download.sourceId || null,
    download.collectionId || null,
    download.batchId || null,
    download.status || 'downloading',
    download.fetchSubtitles != null ? (download.fetchSubtitles ? 1 : 0) : 1
  );
}

export function addBatch(batch: {
  id: string;
  profileId: string;
  title: string;
  type: 'season' | 'collection';
  mediaId?: string;
  season?: number;
  collectionId?: number;
  total: number;
}): void {
  db!.prepare(
    `INSERT INTO batches (id, profile_id, title, type, media_id, season, collection_id, total)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    batch.id,
    batch.profileId,
    batch.title,
    batch.type,
    batch.mediaId || null,
    batch.season || null,
    batch.collectionId || null,
    batch.total
  );
}

export function updateBatch(id: string, updates: {
  completed?: number;
  failed?: number;
  skipped?: number;
  status?: string;
}): void {
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.completed !== undefined) { fields.push('completed = ?'); values.push(updates.completed); }
  if (updates.failed !== undefined) { fields.push('failed = ?'); values.push(updates.failed); }
  if (updates.skipped !== undefined) { fields.push('skipped = ?'); values.push(updates.skipped); }
  if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }

  if (fields.length === 0) return;
  values.push(id);
  db!.prepare(`UPDATE batches SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function getBatch(id: string): any | null {
  return db!.prepare('SELECT * FROM batches WHERE id = ?').get(id) || null;
}

export function getDownloadsByBatch(batchId: string): any[] {
  return db!.prepare(
    `SELECT d.*, gm.title, gm.type, gm.poster_path, gm.tmdb_id
     FROM downloads d
     INNER JOIN global_media gm ON d.media_id = gm.id
     WHERE d.batch_id = ?
     ORDER BY d.added_at ASC`
  ).all(batchId);
}

export function updateDownload(id: string, updates: {
  status?: string;
  progressPercent?: number;
  progressBytes?: number;
  totalBytes?: number;
  speed?: string;
  error?: string;
  filePath?: string;
  vaultPath?: string;
  remuxPath?: string;
  subtitlesPath?: string;
  size?: number;
  processId?: number;
  startedAt?: string;
  completedAt?: string;
  episodeName?: string;
  m3u8Url?: string;
  referer?: string;
  cookies?: string;
  watchedPosition?: number;
  finished?: number;
}): void {
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
  if (updates.progressPercent !== undefined) { fields.push('progress_percent = ?'); values.push(updates.progressPercent); }
  if (updates.progressBytes !== undefined) { fields.push('progress_bytes = ?'); values.push(updates.progressBytes); }
  if (updates.totalBytes !== undefined) { fields.push('total_bytes = ?'); values.push(updates.totalBytes); }
  if (updates.speed !== undefined) { fields.push('speed = ?'); values.push(updates.speed); }
  if (updates.error !== undefined) { fields.push('error = ?'); values.push(updates.error); }
  if (updates.filePath !== undefined) { fields.push('file_path = ?'); values.push(updates.filePath); }
  if (updates.vaultPath !== undefined) { fields.push('vault_path = ?'); values.push(updates.vaultPath); }
  if (updates.remuxPath !== undefined) { fields.push('remux_path = ?'); values.push(updates.remuxPath); }
  if (updates.subtitlesPath !== undefined) { fields.push('subtitles_path = ?'); values.push(updates.subtitlesPath); }
  if (updates.size !== undefined) { fields.push('size = ?'); values.push(updates.size); }
  if (updates.processId !== undefined) { fields.push('process_id = ?'); values.push(updates.processId); }
  if (updates.watchedPosition !== undefined) { fields.push('watched_position = ?'); values.push(updates.watchedPosition); }
  if (updates.finished !== undefined) { fields.push('finished = ?'); values.push(updates.finished); }
  if (updates.startedAt !== undefined) { fields.push('started_at = ?'); values.push(updates.startedAt); }
  if (updates.completedAt !== undefined) { fields.push('completed_at = ?'); values.push(updates.completedAt); }
  if (updates.episodeName !== undefined) { fields.push('episode_name = ?'); values.push(updates.episodeName); }
  if (updates.m3u8Url !== undefined) { fields.push('m3u8_url = ?'); values.push(updates.m3u8Url); }
  if (updates.referer !== undefined) { fields.push('referer = ?'); values.push(updates.referer); }
  if (updates.cookies !== undefined) { fields.push('cookies = ?'); values.push(updates.cookies); }

  if (fields.length === 0) return;
  values.push(id);
  db!.prepare(`UPDATE downloads SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function getDownloads(profileId: string): any[] {
  return db!.prepare(
    `SELECT d.*, gm.title, gm.type, gm.poster_path, gm.tmdb_id, b.title AS batch_title, b.status AS batch_status
     FROM downloads d
     INNER JOIN global_media gm ON d.media_id = gm.id
     LEFT JOIN batches b ON d.batch_id = b.id
     WHERE d.profile_id = ?
     ORDER BY d.added_at DESC`
  ).all(profileId);
}

export function getDownload(id: string): any | null {
  return db!.prepare(
    `SELECT d.*, gm.title, gm.type, gm.poster_path, gm.tmdb_id
     FROM downloads d
     INNER JOIN global_media gm ON d.media_id = gm.id
     WHERE d.id = ?`
  ).get(id) || null;
}

export function deleteDownload(id: string): void {
  db!.prepare('DELETE FROM downloads WHERE id = ?').run(id);
}

export function getActiveDownloads(profileId: string): any[] {
  return db!.prepare(
    `SELECT d.*, gm.title, gm.type, gm.poster_path, gm.tmdb_id
     FROM downloads d
     INNER JOIN global_media gm ON d.media_id = gm.id
     WHERE d.profile_id = ? AND d.status = 'downloading'
     ORDER BY d.added_at DESC`
  ).all(profileId);
}
