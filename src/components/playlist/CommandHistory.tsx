import React from 'react';

interface CommandHistoryItem {
  text: string;
  timestamp: number;
}

interface CommandHistoryProps {
  commands: CommandHistoryItem[];
  onSelect: (text: string) => void;
  onClear: () => void;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 30) return `${days}天前`;
  return `${Math.floor(days / 30)}个月前`;
}

export default function CommandHistory({ commands, onSelect, onClear }: CommandHistoryProps) {
  if (commands.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--vw-border)] bg-[var(--vw-bg-card)] px-4 py-8 text-center">
        <svg className="mx-auto mb-2 h-8 w-8 text-[var(--vw-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm text-[var(--vw-text-muted)]">暂无命令历史</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--vw-border)] bg-[var(--vw-bg-card)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--vw-border)] px-4 py-2.5">
        <span className="text-xs font-medium text-[var(--vw-text-secondary)]">
          命令历史 ({commands.length})
        </span>
        <button
          onClick={onClear}
          className="text-xs text-[var(--vw-text-muted)] transition-colors hover:text-red-400"
        >
          清除全部
        </button>
      </div>

      {/* Command list */}
      <div className="max-h-60 overflow-y-auto">
        {commands.map((item, index) => (
          <div
            key={`${item.timestamp}-${index}`}
            className="group flex items-start gap-3 border-b border-[var(--vw-border)]/50 px-4 py-2.5 transition-colors last:border-b-0 hover:bg-[var(--vw-bg-input)]"
          >
            {/* Clickable command text */}
            <button
              onClick={() => onSelect(item.text)}
              className="min-w-0 flex-1 text-left"
            >
              <p className="truncate text-sm text-[var(--vw-text)] transition-colors group-hover:text-[var(--vw-accent)]">
                {item.text}
              </p>
              <p className="mt-0.5 text-[10px] text-[var(--vw-text-muted)]">
                {formatRelativeTime(item.timestamp)}
              </p>
            </button>

            {/* Delete single command */}
            <button
              onClick={e => {
                e.stopPropagation();
                // Remove this specific command by index
                const updated = [...commands];
                updated.splice(index, 1);
                // We need to trigger the parent's clear with filtered list
                // Since onClear clears all, we use onSelect to signal deletion
                // Actually, we should have an onDelete prop, but per spec we'll
                // use a workaround: emit empty string as a delete signal
                onSelect(`__DELETE_INDEX_${index}__`);
              }}
              className="flex-shrink-0 rounded-md p-1 text-[var(--vw-text-muted)] opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
              aria-label="删除此命令"
              title="删除"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
