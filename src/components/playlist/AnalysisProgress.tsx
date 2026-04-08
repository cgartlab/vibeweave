import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase/client';

interface AnalysisProgressProps {
  playlistId: string;
  onComplete?: () => void;
}

interface PlaylistStatus {
  status: string;
  analyzed_count: number;
  total_count: number;
}

interface SongStatusCounts {
  pending: number;
  analyzing: number;
  completed: number;
  failed: number;
}

function getStatusText(status: string, analyzedCount: number, totalCount: number, failedCount: number): string {
  switch (status) {
    case 'draft':
      return '等待分析';
    case 'analyzing':
      return `正在分析... ${analyzedCount}/${totalCount}`;
    case 'completed':
      return '分析完成';
    case 'completed_with_errors':
      return `部分失败 ${failedCount}首`;
    default:
      return '未知状态';
  }
}

export default function AnalysisProgress({ playlistId, onComplete }: AnalysisProgressProps) {
  const [playlistStatus, setPlaylistStatus] = useState<PlaylistStatus | null>(null);
  const [songStatusCounts, setSongStatusCounts] = useState<SongStatusCounts>({
    pending: 0,
    analyzing: 0,
    completed: 0,
    failed: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(true);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const fetchStatus = useCallback(async () => {
    try {
      // Fetch playlist status
      const { data: playlistData, error: playlistError } = await supabase
        .from('playlists')
        .select('status, analyzed_count, total_count')
        .eq('id', playlistId)
        .single();

      if (playlistError) {
        setError('获取播放列表状态失败');
        return;
      }

      if (playlistData) {
        setPlaylistStatus(playlistData);
      }

      // Fetch per-song status counts
      const { data: songsData, error: songsError } = await supabase
        .from('songs')
        .select('analysis_status')
        .eq('playlist_id', playlistId);

      if (songsError) {
        setError('获取歌曲状态失败');
        return;
      }

      if (songsData) {
        const counts: SongStatusCounts = {
          pending: 0,
          analyzing: 0,
          completed: 0,
          failed: 0,
        };

        for (const song of songsData) {
          const status = song.analysis_status as keyof SongStatusCounts;
          if (status in counts) {
            counts[status]++;
          }
        }

        setSongStatusCounts(counts);
      }

      setError(null);

      // Stop polling if analysis is done
      if (
        playlistData &&
        (playlistData.status === 'completed' || playlistData.status === 'completed_with_errors')
      ) {
        setIsPolling(false);
        onCompleteRef.current?.();
      }
    } catch {
      setError('网络错误，请重试');
    }
  }, [playlistId]);

  useEffect(() => {
    if (!isPolling) return;

    fetchStatus();

    const interval = setInterval(() => {
      fetchStatus();
    }, 3000);

    return () => {
      clearInterval(interval);
    };
  }, [isPolling, fetchStatus]);

  if (!playlistStatus) {
    return (
      <div className="bg-vw-bg-card rounded-xl border border-vw-border p-4">
        <div className="flex items-center gap-2 text-vw-text-muted text-sm">
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span>加载中...</span>
        </div>
      </div>
    );
  }

  const { status, analyzed_count, total_count } = playlistStatus;
  const percentage = total_count > 0 ? Math.round((analyzed_count / total_count) * 100) : 0;
  const isComplete = status === 'completed' || status === 'completed_with_errors';
  const failedCount = songStatusCounts.failed;

  return (
    <div className="bg-vw-bg-card rounded-xl border border-vw-border p-4 space-y-3">
      {/* Status text and percentage */}
      <div className="flex items-center justify-between">
        <span className="text-vw-text text-sm font-medium">
          {getStatusText(status, analyzed_count, total_count, failedCount)}
        </span>
        <span className="text-vw-text-secondary text-sm">
          {analyzed_count} / {total_count}
          <span className="ml-2 text-vw-text-muted">({percentage}%)</span>
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative h-2.5 w-full rounded-full bg-vw-bg-input overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${percentage}%`,
            background: isComplete
              ? 'linear-gradient(90deg, var(--vw-success), var(--vw-cyan))'
              : 'linear-gradient(90deg, var(--vw-accent-amber), var(--vw-cyan))',
          }}
        />
        {!isComplete && (
          <div
            className="absolute inset-y-0 left-0 rounded-full animate-pulse"
            style={{
              width: `${percentage}%`,
              background: 'linear-gradient(90deg, var(--vw-accent-amber), var(--vw-cyan))',
              opacity: 0.5,
            }}
          />
        )}
      </div>

      {/* Per-song status counts */}
      <div className="flex items-center gap-4 text-xs text-vw-text-muted">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-vw-text-muted" />
          待分析: {songStatusCounts.pending}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-vw-accent-amber" />
          分析中: {songStatusCounts.analyzing}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-vw-success" />
          已完成: {songStatusCounts.completed}
        </span>
        {songStatusCounts.failed > 0 && (
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-vw-error" />
            失败: {songStatusCounts.failed}
          </span>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="text-vw-error text-xs flex items-center gap-1">
          <svg
            className="h-3.5 w-3.5 shrink-0"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          {error}
        </div>
      )}
    </div>
  );
}
