import React from 'react';

type PlaylistStatus = 'draft' | 'analyzing' | 'completed';

interface PlaylistCardProps {
  id: string;
  name: string;
  coverUrl?: string;
  songCount: number;
  status: PlaylistStatus;
}

const STATUS_CONFIG: Record<PlaylistStatus, { label: string; classes: string }> = {
  draft: {
    label: '草稿',
    classes: 'bg-[var(--vw-bg-input)] text-[var(--vw-text-muted)] border-[var(--vw-border)]',
  },
  analyzing: {
    label: '分析中',
    classes: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  completed: {
    label: '已完成',
    classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
};

const GRADIENT_PLACEHOLDERS = [
  'from-purple-600 to-indigo-800',
  'from-amber-600 to-orange-800',
  'from-cyan-600 to-teal-800',
  'from-rose-600 to-pink-800',
  'from-emerald-600 to-green-800',
  'from-violet-600 to-purple-800',
];

function getGradientForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GRADIENT_PLACEHOLDERS[Math.abs(hash) % GRADIENT_PLACEHOLDERS.length];
}

export default function PlaylistCard({ id, name, coverUrl, songCount, status }: PlaylistCardProps) {
  const statusConfig = STATUS_CONFIG[status];
  const gradientClass = getGradientForId(id);

  const handleClick = () => {
    window.location.href = `/weave/${id}`;
  };

  return (
    <button
      onClick={handleClick}
      className="group w-full overflow-hidden rounded-xl border border-[var(--vw-border)] bg-[var(--vw-bg-card)] text-left transition-all duration-300 hover:border-[var(--vw-accent)]/40 hover:shadow-lg hover:shadow-[var(--vw-accent)]/5 hover:-translate-y-0.5"
    >
      {/* Cover image / gradient placeholder */}
      <div className="relative aspect-square w-full overflow-hidden">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradientClass}`}>
            <svg className="h-12 w-12 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
            </svg>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-300 group-hover:bg-black/30">
          <svg className="h-10 w-10 text-white opacity-0 transition-all duration-300 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
      </div>

      {/* Info section */}
      <div className="p-4">
        <h3 className="mb-2 truncate text-sm font-semibold text-[var(--vw-text)]">
          {name}
        </h3>

        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--vw-text-muted)]">
            {songCount} 首歌曲
          </span>

          <span className={`
            inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium
            ${statusConfig.classes}
          `}>
            {status === 'analyzing' && (
              <span className="mr-1 inline-flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-1.5 w-1.5 animate-ping rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500"></span>
              </span>
            )}
            {statusConfig.label}
          </span>
        </div>
      </div>
    </button>
  );
}
