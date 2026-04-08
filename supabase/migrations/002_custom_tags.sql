-- Custom tags table
CREATE TABLE custom_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  tag_name VARCHAR(50) NOT NULL,
  tag_type VARCHAR(20) NOT NULL CHECK (tag_type IN ('emotion', 'vibe')),
  color VARCHAR(7) DEFAULT '#6c5ce7',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tag_name)
);

ALTER TABLE custom_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_isolate_own_tags" ON custom_tags FOR ALL USING (auth.uid() = user_id);

-- Song tags junction table
CREATE TABLE song_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES custom_tags(id) ON DELETE CASCADE,
  confidence DECIMAL(3,2) DEFAULT 1.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(song_id, tag_id)
);

ALTER TABLE song_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_isolate_own_song_tags" ON song_tags FOR ALL USING (
  auth.uid() = (
    SELECT p.user_id FROM song_tags st
    JOIN songs s ON st.song_id = s.id
    JOIN playlists p ON s.playlist_id = p.id
    WHERE st.id = song_tags.id
  )
);

CREATE INDEX idx_custom_tags_user_id ON custom_tags(user_id);
CREATE INDEX idx_song_tags_song_id ON song_tags(song_id);
CREATE INDEX idx_song_tags_tag_id ON song_tags(tag_id);
