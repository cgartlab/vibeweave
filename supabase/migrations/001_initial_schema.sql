-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User profiles table
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_platform VARCHAR(20) DEFAULT 'netease',
  platform_user_id VARCHAR(255),
  platform_cookie TEXT,
  display_name VARCHAR(100),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_data_isolation" ON user_profiles FOR ALL USING (auth.uid() = id);

-- Playlists table
CREATE TABLE playlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  platform_playlist_id VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  source_url TEXT,
  cover_url TEXT,
  vibe_target JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'draft',
  analyzed_count INTEGER DEFAULT 0,
  total_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_isolate_own_playlists" ON playlists FOR ALL USING (auth.uid() = user_id);

-- Songs table
CREATE TABLE songs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  platform_song_id VARCHAR(255) NOT NULL,
  title VARCHAR(500) NOT NULL,
  artist VARCHAR(500) NOT NULL,
  album VARCHAR(500),
  duration INTEGER,
  lyrics TEXT,
  sort_order INTEGER DEFAULT 0,
  is_locked BOOLEAN DEFAULT false,
  analysis_status VARCHAR(20) DEFAULT 'pending',
  analysis_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_isolate_own_songs" ON songs FOR ALL USING (
  auth.uid() = (SELECT user_id FROM playlists WHERE id = songs.playlist_id)
);

-- Vibe analysis table
CREATE TABLE vibe_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  valence DECIMAL(3,2),
  arousal DECIMAL(3,2),
  emotion_confidence JSONB DEFAULT '{}',
  vibe_tags JSONB DEFAULT '{}',
  reasoning TEXT,
  model_version VARCHAR(50),
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(song_id, model_version)
);

ALTER TABLE vibe_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_isolate_own_analysis" ON vibe_analysis FOR ALL USING (
  auth.uid() = (
    SELECT p.user_id FROM vibe_analysis va
    JOIN songs s ON va.song_id = s.id
    JOIN playlists p ON s.playlist_id = p.id
    WHERE va.id = vibe_analysis.id
  )
);

-- Indexes
CREATE INDEX idx_playlists_user_id ON playlists(user_id);
CREATE INDEX idx_playlists_status ON playlists(status);
CREATE INDEX idx_songs_playlist_id ON songs(playlist_id);
CREATE INDEX idx_songs_analysis_status ON songs(analysis_status);
CREATE INDEX idx_vibe_analysis_song_id ON vibe_analysis(song_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_playlists_updated_at BEFORE UPDATE ON playlists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Trigger to automatically create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
