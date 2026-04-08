import React, { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase/client';
import CommandHistory from './CommandHistory';

const STORAGE_KEY = 'vibeweave-command-history';
const MAX_HISTORY = 50;
const MAX_CHARS = 500;

const QUICK_COMMANDS = [
  '按愉悦度从高到低排列',
  '把悲伤的歌放前面',
  '只保留放松和怀旧的歌',
  '让情绪从平静逐渐变兴奋',
];

interface CommandHistoryItem {
  text: string;
  timestamp: number;
}

interface CommandInputProps {
  playlistId: string;
  onCommandResult: (result: { sorted_ids: string[]; filtered_ids?: string[]; note: string }) => void;
  disabled?: boolean;
}

function loadHistory(): CommandHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_HISTORY);
  } catch {
    return [];
  }
}

function saveHistory(items: CommandHistoryItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)));
  } catch {
    // localStorage full or unavailable
  }
}

export default function CommandInput({ playlistId, onCommandResult, disabled = false }: CommandInputProps) {
  const [command, setCommand] = useState('');
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [history, setHistory] = useState<CommandHistoryItem[]>(loadHistory);
  const [showHistory, setShowHistory] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [command]);

  const addToHistory = useCallback((text: string) => {
    setHistory(prev => {
      // Remove duplicate if exists
      const filtered = prev.filter(item => item.text !== text);
      const updated = [{ text, timestamp: Date.now() }, ...filtered].slice(0, MAX_HISTORY);
      saveHistory(updated);
      return updated;
    });
  }, []);

  const handleSend = async () => {
    const trimmed = command.trim();
    if (!trimmed || loading || disabled) return;

    setLoading(true);
    setError('');
    setNote('');

    try {
      const { data, error: fnError } = await supabase.functions.invoke('parse-command', {
        body: { command: trimmed, playlist_id: playlistId },
      });

      if (fnError) {
        throw fnError;
      }

      if (data && data.sorted_ids) {
        onCommandResult({
          sorted_ids: data.sorted_ids || [],
          filtered_ids: data.filtered_ids,
          note: data.note || '已调整歌单',
        });
        setNote(data.note || '已调整歌单');
        addToHistory(trimmed);
        setCommand('');
      } else {
        throw new Error('返回数据格式异常');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '请求失败，请重试';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleHistorySelect = (text: string) => {
    setCommand(text);
    setShowHistory(false);
    textareaRef.current?.focus();
  };

  const handleHistoryClear = () => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const handleQuickCommand = (text: string) => {
    setCommand(text);
    textareaRef.current?.focus();
  };

  return (
    <div className="space-y-3">
      {/* Input area */}
      <div className="rounded-xl border border-[var(--vw-border)] bg-[var(--vw-bg-card)] p-4 transition-colors focus-within:border-[var(--vw-accent)]/50">
        <div className="flex gap-3">
          <textarea
            ref={textareaRef}
            value={command}
            onChange={e => setCommand(e.target.value.slice(0, MAX_CHARS))}
            onKeyDown={handleKeyDown}
            placeholder="输入自然语言指令，如「按愉悦度从高到低排列」..."
            disabled={disabled || loading}
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-[var(--vw-text)] placeholder-[var(--vw-text-muted)] outline-none disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!command.trim() || disabled || loading}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--vw-accent)] text-white transition-all hover:bg-[var(--vw-accent-hover)] disabled:pointer-events-none disabled:opacity-40"
            aria-label="发送指令"
            title="发送 (Ctrl+Enter)"
          >
            {loading ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            )}
          </button>
        </div>

        {/* Character count and history toggle */}
        <div className="mt-2 flex items-center justify-between">
          <span className={`text-xs tabular-nums ${command.length >= MAX_CHARS ? 'text-red-400' : 'text-[var(--vw-text-muted)]'}`}>
            {command.length}/{MAX_CHARS}
          </span>
          <button
            onClick={() => setShowHistory(prev => !prev)}
            className="flex items-center gap-1 text-xs text-[var(--vw-text-muted)] transition-colors hover:text-[var(--vw-text-secondary)]"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            历史记录
          </button>
        </div>
      </div>

      {/* Quick command chips */}
      <div className="flex flex-wrap gap-2">
        {QUICK_COMMANDS.map(text => (
          <button
            key={text}
            onClick={() => handleQuickCommand(text)}
            disabled={disabled || loading}
            className="inline-flex items-center rounded-full border border-[var(--vw-border)] bg-[var(--vw-bg-card)] px-3 py-1.5 text-xs text-[var(--vw-text-secondary)] transition-all hover:border-[var(--vw-accent)]/40 hover:bg-[var(--vw-accent)]/5 hover:text-[var(--vw-accent)] disabled:pointer-events-none disabled:opacity-40"
          >
            {text}
          </button>
        ))}
      </div>

      {/* AI response note */}
      {note && (
        <div className="flex items-start gap-2 rounded-lg border border-[var(--vw-accent)]/20 bg-[var(--vw-accent)]/5 px-3 py-2.5">
          <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--vw-accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
          </svg>
          <p className="text-xs leading-relaxed text-[var(--vw-text-secondary)]">{note}</p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5">
          <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-xs leading-relaxed text-red-400">{error}</p>
        </div>
      )}

      {/* Command History */}
      {showHistory && (
        <CommandHistory
          commands={history}
          onSelect={handleHistorySelect}
          onClear={handleHistoryClear}
        />
      )}
    </div>
  );
}
