import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase/client';
import SongList from '../playlist/SongList';
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

// ── Analyze Button ───────────────────────────────────────────────────────────

function AnalyzeButton({
  playlistId,
  songCount,
  onAnalysisStart,
}: {
  playlistId: string;
  songCount: number;
  onAnalysisStart: () => void;
}) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (isAnalyzing || songCount === 0) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const { error: fnError } = await supabase.functions.invoke('analyze-playlist', {
        body: { playlistId },
      });

      if (fnError) throw fnError;

      onAnalysisStart();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start analysis';
      setError(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleAnalyze}
        disabled={isAnalyzing || songCount === 0}
        className={`
          inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5
          text-sm font-medium transition-all duration-200
          ${
            isAnalyzing || songCount === 0
              ? 'cursor-not-allowed bg-vw-border/50 text-vw-text-muted'
              : 'bg-vw-accent text-white shadow-md shadow-vw-accent/25 hover:bg-vw-accent-hover active:scale-[0.98]'
          }
        `}
      >
        {isAnalyzing ? (
          <>
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Analyzing...
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Analyze All Songs
          </>
        )}
      </button>
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}

// ── Analysis Progress ────────────────────────────────────────────────────────

function AnalysisProgress({ songs }: { songs: Song[] }) {
  const total = songs.length;
  const completed = songs.filter((s) => s.analysisStatus === 'completed').length;
  const failed = songs.filter((s) => s.analysisStatus === 'failed').length;
  const analyzing = songs.filter((s) => s.analysisStatus === 'analyzing').length;
  const inProgress = analyzing > 0;

  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

  if (total === 0 || (!inProgress && completed === 0 && failed === 0)) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-vw-text-secondary">
          {completed} of {total} analyzed
        </span>
        <span className="tabular-nums text-vw-text-muted">{progressPercent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-vw-border/50">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${
            inProgress
              ? 'bg-amber-500'
              : completed === total
                ? 'bg-emerald-500'
                : 'bg-vw-accent'
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      {failed > 0 && (
        <p className="text-xs text-red-400">
          {failed} song{failed > 1 ? 's' : ''} failed to analyze
        </p>
      )}
    </div>
  );
}

// ── Command Input Placeholder ────────────────────────────────────────────────

function CommandInput() {
  const [command, setCommand] = useState('');

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-vw-text-secondary">
        AI Command
      </label>
      <textarea
        value={command}
        onChange={(e) => setCommand(e.target.value)}
        placeholder="e.g., &quot;Sort by energy, from high to low&quot; or &quot;Create a chill evening flow&quot;"
        rows={3}
        className="w-full resize-none rounded-lg border border-vw-border bg-[var(--vw-bg-input)] px-3 py-2 text-sm text-vw-text placeholder-vw-text-muted transition-colors focus:border-vw-accent focus:outline-none focus:ring-1 focus:ring-vw-accent"
      />
      <button
        disabled={!command.trim()}
        className="inline-flex items-center gap-2 rounded-lg bg-vw-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-vw-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        Apply Command
      </button>
    </div>
  );
}

// ── Emotion Chart Placeholder ────────────────────────────────────────────────

function EmotionChartPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-vw-border py-12">
      <svg
        className="mb-3 h-10 w-10 text-vw-text-muted"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
        />
      </svg>
      <p className="text-sm font-medium text-vw-text-secondary">Emotion Chart</p>
      <p className="mt-1 text-xs text-vw-text-muted">
        Analyze songs to see the emotional landscape
      </p>
    </div>
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
      .from('playlist_songs')
      .select('*, analysis:song_analyses(*)')
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

  // Handlers
  const handleReorder = useCallback(
    async (songIds: string[]) => {
      // Optimistic update already handled by SongList local state
      // Persist to Supabase
      const updates = songIds.map((id, index) => ({
        id,
        sort_order: index,
      }));

      const { error } = await supabase
        .from('playlist_songs')
        .upsert(updates, { onConflict: 'id' });

      if (error) {
        console.error('Failed to reorder songs:', error);
        // Revert by refetching
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

      // Optimistic update
      setSongs((prev) =>
        prev.map((s) => (s.id === id ? { ...s, isLocked: newLocked } : s))
      );

      const { error } = await supabase
        .from('playlist_songs')
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
      // Optimistic update
      setSongs((prev) => prev.filter((s) => s.id !== id));

      const { error } = await supabase
        .from('playlist_songs')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Failed to delete song:', error);
        fetchPlaylist();
      }

      // Update song count
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

        <div className="mt-4 flex items-center gap-4 text-sm text-vw-text-muted">
          <span className="flex items-center gap-1.5">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            {playlist.song_count} song{playlist.song_count !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1.5">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Updated {new Date(playlist.updated_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* ── Main Content: Two-Column Layout ────────────────────────────── */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left / Main: Song List */}
        <div className="lg:col-span-2">
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

          {/* ── Emotion Chart Area ──────────────────────────────────────── */}
          <div className="mt-8">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-vw-text-muted">
              Emotional Landscape
            </h2>
            <div className="rounded-xl border border-vw-border bg-vw-bg-card p-4">
              <EmotionChartPlaceholder />
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

            <AnalysisProgress songs={songs} />

            <div className="mt-4">
              <AnalyzeButton
                playlistId={playlist.id}
                songCount={songs.length}
                onAnalysisStart={fetchPlaylist}
              />
            </div>
          </div>

          {/* Command Input */}
          <div className="rounded-xl border border-vw-border bg-vw-bg-card p-4">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-vw-text-muted">
              AI Commands
            </h2>
            <CommandInput />
          </div>

          {/* Quick Stats */}
          <div className="rounded-xl border border-vw-border bg-vw-bg-card p-4">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-vw-text-muted">
              Quick Stats
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-[var(--vw-bg-input)] p-3 text-center">
                <p className="text-lg font-bold text-vw-text">
                  {songs.filter((s) => s.analysisStatus === 'completed').length}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-vw-text-muted">
                  Analyzed
                </p>
              </div>
              <div className="rounded-lg bg-[var(--vw-bg-input)] p-3 text-center">
                <p className="text-lg font-bold text-vw-text">
                  {songs.filter((s) => s.isLocked).length}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-vw-text-muted">
                  Locked
                </p>
              </div>
              <div className="rounded-lg bg-[var(--vw-bg-input)] p-3 text-center">
                <p className="text-lg font-bold text-vw-text">
                  {songs.length > 0
                    ? formatTotalDuration(songs.reduce((sum, s) => sum + s.duration, 0))
                    : '0:00'}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-vw-text-muted">
                  Duration
                </p>
              </div>
              <div className="rounded-lg bg-[var(--vw-bg-input)] p-3 text-center">
                <p className="text-lg font-bold text-vw-text">
                  {new Set(songs.map((s) => s.artist)).size}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-vw-text-muted">
                  Artists
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
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
