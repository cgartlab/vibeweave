-- These columns should already exist from the initial schema
-- This migration ensures they exist (idempotent)
ALTER TABLE songs ADD COLUMN IF NOT EXISTS analysis_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE songs ADD COLUMN IF NOT EXISTS analysis_error TEXT;

-- Add index for querying by status
CREATE INDEX IF NOT EXISTS idx_songs_analysis_status ON songs(analysis_status);
