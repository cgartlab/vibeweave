import { useState } from 'react';
import { supabase } from '../../lib/supabase/client';

interface AnalyzeButtonProps {
  playlistId: string;
  songCount: number;
  onAnalysisStart?: () => void;
}

type ButtonState = 'idle' | 'loading' | 'done';

function showToast(message: string, type: 'success' | 'error' = 'error') {
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-slide-in-right ${
    type === 'error'
      ? 'bg-red-900/90 text-red-200 border border-red-700'
      : 'bg-green-900/90 text-green-200 border border-green-700'
  }`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    toast.classList.remove('animate-slide-in-right');
    toast.classList.add('animate-slide-out-right');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

export default function AnalyzeButton({ playlistId, songCount, onAnalysisStart }: AnalyzeButtonProps) {
  const [state, setState] = useState<ButtonState>('idle');

  const handleClick = async () => {
    if (state !== 'idle' || songCount === 0) return;

    setState('loading');

    try {
      const { data, error } = await supabase.functions.invoke('analyze-batch', {
        body: { playlist_id: playlistId },
      });

      if (error) {
        showToast(`分析请求失败: ${error.message}`);
        setState('idle');
        return;
      }

      if (data?.error) {
        showToast(`分析请求失败: ${data.error}`);
        setState('idle');
        return;
      }

      setState('done');
      onAnalysisStart?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      showToast(`分析请求失败: ${message}`);
      setState('idle');
    }
  };

  const isDisabled = state !== 'idle' || songCount === 0;

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      className={`
        inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium
        transition-all duration-200 cursor-pointer
        ${
          isDisabled
            ? 'bg-vw-bg-input text-vw-text-muted cursor-not-allowed opacity-60'
            : state === 'done'
              ? 'bg-green-600/20 text-green-400 border border-green-600/30 hover:bg-green-600/30'
              : 'bg-vw-accent text-white hover:bg-vw-accent-hover active:scale-[0.97]'
        }
      `}
    >
      {state === 'idle' && (
        <>
          {/* Sparkle icon */}
          <svg
            className="w-4 h-4"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
          </svg>
          <span>开始情绪分析</span>
        </>
      )}

      {state === 'loading' && (
        <>
          {/* Spinner icon */}
          <svg
            className="animate-spin w-4 h-4"
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
          <span>分析中...</span>
        </>
      )}

      {state === 'done' && (
        <>
          {/* Checkmark icon */}
          <svg
            className="w-4 h-4"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span>分析完成</span>
        </>
      )}
    </button>
  );
}
