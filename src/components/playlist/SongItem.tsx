import React from 'react';
import type { SongAnalysisResult } from '../../lib/ai/types';

export interface Song {
  id: string;
  platformSongId: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // seconds
  sortOrder: number;
  isLocked: boolean;
  analysisStatus: 'pending' | 'analyzing' | 'completed' | 'failed';
  analysis?: SongAnalysisResult | null;
}

interface SongItemProps {
  song: Song;
  index: number;
  onLockToggle: (id: string) => void;
  onDelete: (id: string) => void;
  isDragging: boolean;
  dragHandleProps?: Record<string, unknown>;
}

/** Emotion label to display name and color mapping (Chinese keys to match AI analysis output) */
const EMOTION_COLORS: Record<string, { label: string; bg: string; text: string }> = {
  '快乐': { label: '快乐', bg: 'bg-amber-500/20', text: 'text-amber-400' },
  '悲伤': { label: '悲伤', bg: 'bg-purple-500/20', text: 'text-purple-400' },
  '放松': { label: '放松', bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  '兴奋': { label: '兴奋', bg: 'bg-red-500/20', text: 'text-red-400' },
  '宁静': { label: '宁静', bg: 'bg-blue-500/20', text: 'text-blue-400' },
  '紧张': { label: '紧张', bg: 'bg-pink-500/20', text: 'text-pink-400' },
  '怀旧': { label: '怀旧', bg: 'bg-orange-500/20', text: 'text-orange-400' },
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getTopEmotion(analysis?: SongAnalysisResult | null): { label: string; bg: string; text: string } | null {
  if (!analysis?.emotion_confidence) return null;

  const entries = Object.entries(analysis.emotion_confidence);
  if (entries.length === 0) return null;

  const [topKey, topValue] = entries.reduce<[string, number]>(
    (best, [key, value]) => (value > best[1] ? [key, value] : best),
    entries[0]
  );

  if (topValue < 0.1) return null;

  const matched = EMOTION_COLORS[topKey];
  if (matched) return matched;

  // Fallback for unknown emotion keys
  return {
    label: topKey,
    bg: 'bg-vw-accent/20',
    text: 'text-vw-accent',
  };
}

function getAnalysisStatusBadge(status: Song['analysisStatus']): React.ReactNode {
  switch (status) {
    case 'analyzing':
      return (
        <span className="flex items-center gap-1 text-xs text-vw-text-muted">
          <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Analyzing
        </span>
      );
    case 'failed':
      return (
        <span className="flex items-center gap-1 text-xs text-red-400">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Failed
        </span>
      );
    default:
      return null;
  }
}

export default function SongItem({
  song,
  index,
  onLockToggle,
  onDelete,
  isDragging,
  dragHandleProps,
}: SongItemProps) {
  const topEmotion = getTopEmotion(song.analysis);

  return (
    <div
      className={`
        group flex items-center gap-3 rounded-lg border px-3 py-2.5
        transition-all duration-200 ease-out
        ${
          isDragging
            ? 'scale-[1.02] border-vw-accent/50 bg-vw-accent/10 opacity-90 shadow-lg shadow-vw-accent/10'
            : 'border-transparent hover:border-vw-border hover:bg-[var(--vw-bg-input)]'
        }
      `}
    >
      {/* Drag Handle */}
      <button
        className="flex-shrink-0 cursor-grab touch-none rounded p-1 text-vw-text-muted transition-colors hover:bg-vw-border/30 hover:text-vw-text-secondary active:cursor-grabbing"
        aria-label="Drag to reorder"
        {...dragHandleProps}
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path d="M7 2a2 2 0 10.001 4.001A2 2 0 007 2zm0 6a2 2 0 10.001 4.001A2 2 0 007 8zm0 6a2 2 0 10.001 4.001A2 2 0 007 14zm6-8a2 2 0 10-.001-4.001A2 2 0 0013 6zm0 2a2 2 0 10.001 4.001A2 2 0 0013 8zm0 6a2 2 0 10.001 4.001A2 2 0 0013 14z" />
        </svg>
      </button>

      {/* Index / Lock Icon */}
      <div className="flex w-6 flex-shrink-0 items-center justify-center">
        {song.isLocked ? (
          <svg className="h-4 w-4 text-vw-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        ) : (
          <span className="text-sm tabular-nums text-vw-text-muted">{index + 1}</span>
        )}
      </div>

      {/* Song Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={`truncate text-sm font-medium ${song.isLocked ? 'text-vw-text' : 'text-vw-text'}`}>
            {song.title}
          </p>
          {topEmotion && (
            <span
              className={`inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${topEmotion.bg} ${topEmotion.text}`}
            >
              {topEmotion.label}
            </span>
          )}
        </div>
        <p className="truncate text-xs text-vw-text-secondary">
          {song.artist}
          {song.album && (
            <>
              <span className="mx-1.5 text-vw-text-muted">&middot;</span>
              {song.album}
            </>
          )}
        </p>
      </div>

      {/* Analysis Status (non-completed) */}
      {song.analysisStatus !== 'completed' && song.analysisStatus !== 'pending' && (
        <div className="flex-shrink-0">
          {getAnalysisStatusBadge(song.analysisStatus)}
        </div>
      )}

      {/* Duration */}
      <span className="flex-shrink-0 text-xs tabular-nums text-vw-text-muted">
        {formatDuration(song.duration)}
      </span>

      {/* Action Buttons */}
      <div className="flex flex-shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {/* Lock/Unlock Toggle */}
        <button
          onClick={() => onLockToggle(song.id)}
          className={`rounded-md p-1.5 transition-colors ${
            song.isLocked
              ? 'text-vw-accent hover:bg-vw-accent/10'
              : 'text-vw-text-muted hover:bg-vw-border/30 hover:text-vw-text-secondary'
          }`}
          aria-label={song.isLocked ? 'Unlock song' : 'Lock song'}
          title={song.isLocked ? 'Unlock position' : 'Lock position'}
        >
          {song.isLocked ? (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
          )}
        </button>

        {/* Delete Button */}
        <button
          onClick={() => onDelete(song.id)}
          className="rounded-md p-1.5 text-vw-text-muted transition-colors hover:bg-red-500/10 hover:text-red-400"
          aria-label="Delete song"
          title="Remove song"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}
