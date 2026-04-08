import React, { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase/client';
import { validatePlaylistUrl } from '../../lib/music/adapter';
import type { MusicPlatform } from '../../lib/music/types';

const PLATFORM_ICONS: Record<MusicPlatform, { label: string; color: string }> = {
  netease: { label: '网易云音乐', color: 'text-red-400' },
  qq: { label: 'QQ音乐', color: 'text-green-400' },
  spotify: { label: 'Spotify', color: 'text-emerald-400' },
};

const PLATFORM_SVGS: Record<MusicPlatform, React.ReactNode> = {
  netease: (
    <svg className="h-5 w-5 text-red-400" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-6h2v6zm4 0h-2v-6h2v6zm-2-8c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/>
    </svg>
  ),
  qq: {
    /* QQ Music icon */
    <svg className="h-5 w-5 text-green-400" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 3a3 3 0 110 6 3 3 0 010-6zm-4.5 9.5a4.5 4.5 0 019 0v1a1 1 0 01-1 1h-7a1 1 0 01-1-1v-1z"/>
    </svg>
  } as React.ReactNode,
  spotify: (
    <svg className="h-5 w-5 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 14.36c-.2.3-.56.4-.86.2-2.36-1.44-5.33-1.77-8.83-.97-.34.08-.66-.14-.74-.46-.08-.34.14-.66.46-.74 3.83-.87 7.12-.5 9.77 1.12.3.18.38.56.2.85zm1.23-2.72c-.24.38-.76.5-1.12.24-2.7-1.66-6.82-2.14-10.02-1.17-.42.12-.86-.1-.98-.52-.12-.42.1-.86.52-.98 3.64-1.1 8.16-.58 11.25 1.32.36.22.48.74.24 1.12h.1zm.1-2.82c-3.24-1.92-8.58-2.1-11.67-1.16-.5.16-1.02-.14-1.18-.62-.16-.5.14-1.02.62-1.18 3.54-1.08 9.42-.86 13.14 1.34.46.26.6.84.34 1.3-.24.46-.84.6-1.3.34l.04-.02z"/>
    </svg>
  ),
};

export default function PlaylistUploader() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [detectedPlatform, setDetectedPlatform] = useState<MusicPlatform | null>(null);

  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUrl(value);
    setError(null);

    if (value.trim()) {
      const parsed = validatePlaylistUrl(value.trim());
      setDetectedPlatform(parsed?.platform ?? null);
    } else {
      setDetectedPlatform(null);
    }
  }, []);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
      setError(null);

      if (text.trim()) {
        const parsed = validatePlaylistUrl(text.trim());
        setDetectedPlatform(parsed?.platform ?? null);
      }
    } catch {
      setError('无法读取剪贴板，请手动粘贴链接');
    }
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      const trimmedUrl = url.trim();
      if (!trimmedUrl) {
        setError('请输入歌单链接');
        return;
      }

      const parsed = validatePlaylistUrl(trimmedUrl);
      if (!parsed) {
        setError('不支持的歌单链接格式，请输入网易云音乐、QQ音乐或 Spotify 的歌单链接');
        return;
      }

      setLoading(true);
      setProgress(10);

      try {
        setProgress(30);

        const { data, error: fnError } = await supabase.functions.invoke('fetch-playlist', {
          body: {
            platform: parsed.platform,
            playlist_id: parsed.id,
          },
        });

        setProgress(80);

        if (fnError) {
          throw fnError;
        }

        if (data?.playlist_id) {
          setProgress(100);
          setTimeout(() => {
            window.location.href = `/weave/${data.playlist_id}`;
          }, 300);
        } else {
          throw new Error('服务器返回数据异常');
        }
      } catch (err) {
        setProgress(0);
        const message =
          err instanceof Error ? err.message : '导入歌单失败，请稍后重试';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [url],
  );

  return (
    <div className="rounded-xl border border-[var(--vw-border)] bg-[var(--vw-bg-card)] p-6">
      <h3 className="mb-4 text-lg font-semibold text-[var(--vw-text)]">导入歌单</h3>
      <p className="mb-4 text-sm text-[var(--vw-text-secondary)]">
        粘贴网易云音乐、QQ音乐或 Spotify 的歌单链接
      </p>

      <form onSubmit={handleSubmit}>
        <div className="flex gap-2">
          {/* URL Input */}
          <div className="relative flex-1">
            <input
              type="url"
              value={url}
              onChange={handleUrlChange}
              placeholder="https://music.163.com/#/playlist?id=..."
              disabled={loading}
              className={`
                h-10 w-full rounded-lg border bg-[var(--vw-bg-input)] pl-3 pr-10 text-sm text-[var(--vw-text)]
                placeholder:text-[var(--vw-text-muted)]
                transition-all duration-200
                focus:outline-none focus:ring-2
                ${error
                  ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20'
                  : detectedPlatform
                    ? 'border-emerald-500/50 focus:border-emerald-500 focus:ring-emerald-500/20'
                    : 'border-[var(--vw-border)] focus:border-[var(--vw-accent)] focus:ring-[var(--vw-accent)]/20'
                }
                disabled:opacity-50
              `}
            />
            {/* Paste button */}
            <button
              type="button"
              onClick={handlePaste}
              disabled={loading}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[var(--vw-text-muted)] transition-colors hover:bg-[var(--vw-bg-card)] hover:text-[var(--vw-text-secondary)] disabled:opacity-50"
              title="从剪贴板粘贴"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              </svg>
            </button>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className={`
              inline-flex items-center gap-2 rounded-lg px-4 text-sm font-medium text-white
              transition-all duration-200
              ${loading || !url.trim()
                ? 'cursor-not-allowed bg-[var(--vw-accent)]/50'
                : 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-lg shadow-amber-500/20 hover:shadow-xl hover:shadow-amber-500/30'
              }
            `}
          >
            {loading ? (
              <>
                <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                导入中...
              </>
            ) : (
              '导入'
            )}
          </button>
        </div>

        {/* Platform detection indicator */}
        {detectedPlatform && !error && (
          <div className="mt-2 flex items-center gap-1.5 text-sm">
            {PLATFORM_SVGS[detectedPlatform]}
            <span className={PLATFORM_ICONS[detectedPlatform].color}>
              {PLATFORM_ICONS[detectedPlatform].label}
            </span>
            <span className="text-[var(--vw-text-muted)]">- 已识别</span>
          </div>
        )}

        {/* Progress bar */}
        {loading && (
          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--vw-bg-input)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-[var(--vw-text-muted)]">
              {progress < 30 && '正在连接服务器...'}
              {progress >= 30 && progress < 80 && '正在获取歌单信息...'}
              {progress >= 80 && progress < 100 && '正在处理数据...'}
              {progress >= 100 && '导入完成！'}
            </p>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}
      </form>
    </div>
  );
}
