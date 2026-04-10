import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase/client';
import SongList from '../playlist/SongList';
import CommandInput from '../playlist/CommandInput';
import EmotionChart from '../playlist/EmotionChart';
import EmotionRadar from '../playlist/EmotionRadar';
import TagManager from '../playlist/TagManager';
import SongTagger from '../playlist/SongTagger';
import AnalysisProgress from '../playlist/AnalysisProgress';
import AnalyzeButton from '../playlist/AnalyzeButton';
import type { Song } from '../playlist/SongItem';

// ── Types ────────────────────────────────────────────────────────────────────

interface PlaylistData {
  id: string;
  name: string;
  description: string | null;
  song_count: number;
  status: 'draft' | 'analyzing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

interface PlaylistSongRow {
  id: string;
  platform_song_id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  sort_order: number;
  is_locked: boolean;
  analysis_status: 'pending' | 'analyzing' | 'completed' | 'failed';
  analysis: {
    valence: number;
    arousal: number;
    emotion_confidence: Record<string, number>;
    vibe_tags: Record<string, number>;
    reasoning: string;
  } | null;
}

/** Flattened song shape expected by EmotionChart / EmotionRadar */
interface ChartSong {
  id: string | number;
  title: string;
  artist: string;
  valence?: number;
  arousal?: number;
  emotion_confidence?: Record<string, number>;
}

/** Tag shape shared by TagManager / SongTagger */
interface Tag {
  id: string;
  tag_name: string;
  tag_type: 'emotion' | 'vibe';
  color: string;
}

// ── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PlaylistData['status'] }) {
  const config: Record<PlaylistData['status'], { label: string; classes: string }> = {
    draft: {
      label: 'Draft',
      classes: 'bg-gray-500/20 text-gray-400',
    },
    analyzing: {
      label: 'Analyzing',
      classes: 'bg-amber-500/20 text-amber-400',
    },
    completed: {
      label: 'Completed',
      classes: 'bg-emerald-500/20 text-emerald-400',
    },
    failed: {
      label: 'Failed',
      classes: 'bg-red-500/20 text-red-400',
    },
  };

  const { label, classes } = config[status] || config.draft;

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes}`}>
      {status === 'analyzing' && (
        <svg className="mr-1 h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {label}
    </span>
  );
}

// ── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Header skeleton */}
      <div className="space-y-3">
        <div className="h-8 w-64 rounded-lg bg-vw-border/30" />
        <div className="h-4 w-96 rounded bg-vw-border/20" />
        <div className="flex gap-3">
          <div className="h-6 w-20 rounded-full bg-vw-border/20" />
          <div className="h-6 w-24 rounded-full bg-vw-border/20" />
        </div>
      </div>
      {/* Song rows skeleton */}
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-3">
            <div className="h-4 w-4 rounded bg-vw-border/20" />
            <div className="h-4 w-4 rounded bg-vw-border/20" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-48 rounded bg-vw-border/20" />
              <div className="h-3 w-32 rounded bg-vw-border/10" />
            </div>
            <div className="h-4 w-10 rounded bg-vw-border/10" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 404 Not Found ────────────────────────────────────────────────────────────

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <svg
        className="mb-4 h-16 w-16 text-vw-text-muted"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
        />
      </svg>
      <h2 className="text-lg font-semibold text-vw-text">Playlist Not Found</h2>
      <p className="mt-2 text-sm text-vw-text-muted">
        The playlist you are looking for does not exist or has been removed.
      </p>
      <a
        href="/"
        className="mt-6 rounded-lg bg-vw-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-vw-accent-hover"
      >
        Go Home
      </a>
    </div>
  );
}

// ── Main Weave Page Component ────────────────────────────────────────────────

export default function WeavePage({ playlistId: playlistIdProp }: { playlistId: string }) {
  // In static deployments, extract the real playlist ID from the URL path
  // since Astro only generates a placeholder page at build time.
  const [resolvedId, setResolvedId] = useState(playlistIdProp);

  useEffect(() => {
    const path = window.location.pathname;
    // Match /vibeweave/weave/<id> or /weave/<id>
    const match = path.match(/\/weave\/([^/]+)/);
    if (match && match[1] && match[1] !== 'placeholder') {
      setResolvedId(match[1]);
    }
  }, []);

  const playlistId = resolvedId;

  const [playlist, setPlaylist] = useState<PlaylistData | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [taggingSongId, setTaggingSongId] = useState<string | null>(null);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [currentSongTags, setCurrentSongTags] = useState<Tag[]>([]);

  // Fetch all custom tags for the user
  useEffect(() => {
    async function fetchAllTags() {
      if (!userId) return;
      try {
        const { data, error } = await supabase
          .from('custom_tags')
          .select('*')
          .eq('user_id', userId);

        if (!error && data) {
          setAllTags(data as Tag[]);
        }
      } catch {
        console.warn('Failed to fetch custom tags');
      }
    }
    fetchAllTags();
  }, [userId]);

  // Fetch current tags for the selected song
  useEffect(() => {
    async function fetchSongTags() {
      if (!taggingSongId) {
        setCurrentSongTags([]);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('song_tags')
          .select('tag_id, custom_tags(*)')
          .eq('song_id', taggingSongId);

        if (!error && data) {
          const tags: Tag[] = data
            .map((row: { custom_tags: Tag | null }) => row.custom_tags)
            .filter((t: Tag | null): t is Tag => t != null);
          setCurrentSongTags(tags);
        }
      } catch {
        console.warn('Failed to fetch song tags');
        setCurrentSongTags([]);
      }
    }
    fetchSongTags();
  }, [taggingSongId]);

  // Fetch current user ID for TagManager
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUserId(data.user.id);
      }
    });
  }, []);

  // Fetch playlist data
  const fetchPlaylist = useCallback(async () => {
    setLoading(true);
    setNotFound(false);

    const { data: playlistData, error: playlistError } = await supabase
      .from('playlists')
      .select('*')
      .eq('id', playlistId)
      .single();

    if (playlistError || !playlistData) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setPlaylist(playlistData as PlaylistData);

    const { data: songData, error: songsError } = await supabase
      .from('songs')
      .select('*, analysis:vibe_analysis(*)')
      .eq('playlist_id', playlistId)
      .order('sort_order', { ascending: true });

    if (!songsError && songData) {
      const mappedSongs: Song[] = songData.map((row: PlaylistSongRow & { analysis?: Record<string, unknown> | null }) => ({
        id: row.id,
        platformSongId: row.platform_song_id,
        title: row.title,
        artist: row.artist,
        album: row.album,
        duration: row.duration,
        sortOrder: row.sort_order,
        isLocked: row.is_locked,
        analysisStatus: row.analysis_status,
        analysis: row.analysis
          ? {
              valence: (row.analysis as Record<string, number>).valence ?? 0,
              arousal: (row.analysis as Record<string, number>).arousal ?? 0,
              emotion_confidence: ((row.analysis as Record<string, unknown>).emotion_confidence ?? {}) as Record<string, number>,
              vibe_tags: ((row.analysis as Record<string, unknown>).vibe_tags ?? {}) as Record<string, number>,
              reasoning: ((row.analysis as Record<string, unknown>).reasoning ?? '') as string,
            }
          : null,
      }));
      setSongs(mappedSongs);
    }

    setLoading(false);
  }, [playlistId]);

  useEffect(() => {
    fetchPlaylist();
  }, [fetchPlaylist]);

  // ── Convert Song[] to ChartSong[] for EmotionChart / EmotionRadar ──
  const chartSongs: ChartSong[] = useMemo(
    () =>
      songs
        .filter((s) => s.analysisStatus === 'completed' && s.analysis)
        .map((s) => ({
          id: s.id,
          title: s.title,
          artist: s.artist,
          valence: s.analysis!.valence,
          arousal: s.analysis!.arousal,
          emotion_confidence: s.analysis!.emotion_confidence,
        })),
    [songs]
  );

  // ── Command result handler ──
  const handleCommandResult = useCallback(
    (result: { sorted_ids: string[]; filtered_ids?: string[]; note: string }) => {
      if (result.sorted_ids && result.sorted_ids.length > 0) {
        const reordered = result.sorted_ids
          .map((id) => songs.find((s) => s.id === id))
          .filter((s): s is Song => s != null);

        const sortedSet = new Set(result.sorted_ids);
        const remaining = songs.filter((s) => !sortedSet.has(s.id));

        const newSongs = [...reordered, ...remaining];
        setSongs(newSongs);

        const updates = newSongs.map((s, index) => ({
          id: s.id,
          sort_order: index,
        }));

        supabase
          .from('songs')
          .upsert(updates, { onConflict: 'id' })
          .then(({ error }) => {
            if (error) {
              console.error('Failed to persist AI reorder:', error);
              fetchPlaylist();
            }
          });
      }

      if (result.filtered_ids && result.filtered_ids.length > 0) {
        const filteredSet = new Set(result.filtered_ids);
        setSongs((prev) => prev.filter((s) => filteredSet.has(s.id)));
      }
    },
    [songs, fetchPlaylist]
  );

  // Handlers
  const handleReorder = useCallback(
    async (songIds: string[]) => {
      const updates = songIds.map((id, index) => ({
        id,
        sort_order: index,
      }));

      const { error } = await supabase
        .from('songs')
        .upsert(updates, { onConflict: 'id' });

      if (error) {
        console.error('Failed to reorder songs:', error);
        fetchPlaylist();
      }
    },
    [fetchPlaylist]
  );

  const handleLockToggle = useCallback(
    async (id: string) => {
      const song = songs.find((s) => s.id === id);
      if (!song) return;

      const newLocked = !song.isLocked;

      setSongs((prev) =>
        prev.map((s) => (s.id === id ? { ...s, isLocked: newLocked } : s))
      );

      const { error } = await supabase
        .from('songs')
        .update({ is_locked: newLocked })
        .eq('id', id);

      if (error) {
        console.error('Failed to toggle lock:', error);
        setSongs((prev) =>
          prev.map((s) => (s.id === id ? { ...s, isLocked: !newLocked } : s))
        );
      }
    },
    [songs]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      setSongs((prev) => prev.filter((s) => s.id !== id));

      const { error } = await supabase
        .from('songs')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Failed to delete song:', error);
        fetchPlaylist();
      }

      setPlaylist((prev) =>
        prev ? { ...prev, song_count: Math.max(0, prev.song_count - 1) } : prev
      );
    },
    [fetchPlaylist]
  );

  // Render states
  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <LoadingSkeleton />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <NotFound />
      </div>
    );
  }

  if (!playlist) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* ── Header Section ─────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-vw-text sm:text-3xl">
              {playlist.name}
            </h1>
            {playlist.description && (
              <p className="mt-1 text-sm text-vw-text-secondary">
                {playlist.description}
              </p>
            )}
          </div>
          <StatusBadge status={playlist.status} />
        </div>

        {/* ── Quick Stats (inline in header) ─────────────────────────── */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:inline-flex sm:items-center sm:gap-6">
          <div className="rounded-lg bg-[var(--vw-bg-input)] px-3 py-2 text-center sm:text-left">
            <p className="text-lg font-bold text-vw-text">
              {songs.filter((s) => s.analysisStatus === 'completed').length}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-vw-text-muted">
              Analyzed
            </p>
          </div>
          <div className="rounded-lg bg-[var(--vw-bg-input)] px-3 py-2 text-center sm:text-left">
            <p className="text-lg font-bold text-vw-text">
              {songs.filter((s) => s.isLocked).length}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-vw-text-muted">
              Locked
            </p>
          </div>
          <div className="rounded-lg bg-[var(--vw-bg-input)] px-3 py-2 text-center sm:text-left">
            <p className="text-lg font-bold text-vw-text">
              {songs.length > 0
                ? formatTotalDuration(songs.reduce((sum, s) => sum + s.duration, 0))
                : '0:00'}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-vw-text-muted">
              Duration
            </p>
          </div>
          <div className="rounded-lg bg-[var(--vw-bg-input)] px-3 py-2 text-center sm:text-left">
            <p className="text-lg font-bold text-vw-text">
              {new Set(songs.map((s) => s.artist)).size}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-vw-text-muted">
              Artists
            </p>
          </div>
        </div>
      </div>

      {/* ── Main Content: Two-Column Layout ────────────────────────────── */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left / Main: Song List */}
        <div className="lg:col-span-2 space-y-8">
          {/* Song List Card */}
          <div className="rounded-xl border border-vw-border bg-vw-bg-card p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-vw-text-muted">
                Songs
              </h2>
              <span className="text-xs text-vw-text-muted">
                Drag to reorder
              </span>
            </div>
            <SongList
              songs={songs}
              onReorder={handleReorder}
              onLockToggle={handleLockToggle}
              onDelete={handleDelete}
            />
          </div>

          {/* ── Emotion Visualization Area ─────────────────────────────── */}
          <div>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-vw-text-muted">
              Emotional Landscape
            </h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <EmotionChart songs={chartSongs} />
              <EmotionRadar songs={chartSongs} />
            </div>
          </div>
        </div>

        {/* Right / Sidebar: Controls */}
        <div className="space-y-6">
          {/* Analysis Controls */}
          <div className="rounded-xl border border-vw-border bg-vw-bg-card p-4">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-vw-text-muted">
              Analysis
            </h2>

            <AnalysisProgress playlistId={playlist.id} onComplete={fetchPlaylist} />

            <div className="mt-4">
              <AnalyzeButton
                playlistId={playlist.id}
                songCount={songs.length}
                onAnalysisStart={fetchPlaylist}
              />
            </div>
          </div>

          {/* AI Command Input */}
          <div className="rounded-xl border border-vw-border bg-vw-bg-card p-4">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-vw-text-muted">
              AI Commands
            </h2>
            <CommandInput
              playlistId={playlist.id}
              onCommandResult={handleCommandResult}
            />
          </div>

          {/* Tag Manager */}
          {userId && (
            <div className="rounded-xl border border-vw-border bg-vw-bg-card p-4">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-vw-text-muted">
                Tag Manager
              </h2>
              <TagManager userId={userId} />
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom: Song Tagger Row ────────────────────────────────────── */}
      {songs.length > 0 && (
        <div className="mt-8">
          <div className="rounded-xl border border-vw-border bg-vw-bg-card p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-vw-text-muted">
                Song Tags
              </h2>
              <span className="text-xs text-vw-text-muted">
                Click a song to add tags
              </span>
            </div>

            {/* Song selector chips */}
            <div className="mb-4 flex flex-wrap gap-2">
              {songs.map((song) => (
                <button
                  key={song.id}
                  onClick={() =>
                    setTaggingSongId((prev) => (prev === song.id ? null : song.id))
                  }
                  className={`
                    inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5
                    text-xs font-medium transition-all
                    ${
                      taggingSongId === song.id
                        ? 'border-vw-accent bg-vw-accent/10 text-vw-accent'
                        : 'border-vw-border bg-[var(--vw-bg-input)] text-vw-text-secondary hover:border-vw-accent/40 hover:text-vw-text'
                    }
                  `}
                >
                  {song.title}
                  <span className="text-vw-text-muted">{song.artist}</span>
                </button>
              ))}
            </div>

            {/* Active SongTagger */}
            {taggingSongId && (
              <div className="rounded-lg border border-vw-border/50 bg-[var(--vw-bg-input)] p-3">
                <SongTagger
                  songId={taggingSongId}
                  currentTags={currentSongTags}
                  allTags={allTags}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTotalDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
