import { useMemo } from 'react';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

interface Song {
  id?: string | number;
  title?: string;
  artist?: string;
  valence?: number;
  arousal?: number;
  emotion_confidence?: Record<string, number>;
}

interface EmotionRadarProps {
  songs: Song[];
}

const EMOTION_DIMENSIONS = ['快乐', '悲伤', '放松', '兴奋', '宁静', '紧张', '怀旧'];

const DIMENSION_COLORS: Record<string, { border: string; bg: string }> = {
  快乐: { border: '#ffd93d', bg: 'rgba(255, 217, 61, 0.15)' },
  悲伤: { border: '#6c5ce7', bg: 'rgba(108, 92, 231, 0.15)' },
  放松: { border: '#00b894', bg: 'rgba(0, 184, 148, 0.15)' },
  兴奋: { border: '#ff6b6b', bg: 'rgba(255, 107, 107, 0.15)' },
  宁静: { border: '#74b9ff', bg: 'rgba(116, 185, 255, 0.15)' },
  紧张: { border: '#fd79a8', bg: 'rgba(253, 121, 168, 0.15)' },
  怀旧: { border: '#e17055', bg: 'rgba(225, 112, 85, 0.15)' },
};

export default function EmotionRadar({ songs }: EmotionRadarProps) {
  const analyzedSongs = useMemo(
    () => songs.filter((s) => s.emotion_confidence && Object.keys(s.emotion_confidence).length > 0),
    [songs]
  );

  const { data, dominantEmotion } = useMemo(() => {
    if (analyzedSongs.length === 0) {
      return { data: null, dominantEmotion: '' };
    }

    // 计算每个情绪维度的平均置信度
    const sums: Record<string, number> = {};
    const counts: Record<string, number> = {};

    for (const emotion of EMOTION_DIMENSIONS) {
      sums[emotion] = 0;
      counts[emotion] = 0;
    }

    for (const song of analyzedSongs) {
      const confidence = song.emotion_confidence!;
      for (const emotion of EMOTION_DIMENSIONS) {
        if (confidence[emotion] != null) {
          sums[emotion] += confidence[emotion];
          counts[emotion] += 1;
        }
      }
    }

    const averages = EMOTION_DIMENSIONS.map((emotion) =>
      counts[emotion] > 0 ? sums[emotion] / counts[emotion] : 0
    );

    // 找出主导情绪
    let maxAvg = -1;
    let dominant = '';
    for (let i = 0; i < EMOTION_DIMENSIONS.length; i++) {
      if (averages[i] > maxAvg) {
        maxAvg = averages[i];
        dominant = EMOTION_DIMENSIONS[i];
      }
    }

    // 构建渐变填充色 - 使用主导情绪的颜色
    const dominantColor = DIMENSION_COLORS[dominant] || {
      border: '#9895a8',
      bg: 'rgba(152, 149, 168, 0.15)',
    };

    const chartData = {
      labels: EMOTION_DIMENSIONS,
      datasets: [
        {
          label: '平均情绪置信度',
          data: averages,
          backgroundColor: dominantColor.bg,
          borderColor: dominantColor.border,
          borderWidth: 2,
          pointBackgroundColor: EMOTION_DIMENSIONS.map(
            (e) => DIMENSION_COLORS[e]?.border || '#9895a8'
          ),
          pointBorderColor: '#1a1825',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 8,
          pointHoverBorderWidth: 2,
          pointHoverBorderColor: '#ffffff',
          fill: true,
        },
      ],
    };

    return { data: chartData, dominantEmotion: dominant };
  }, [analyzedSongs]);

  const options: ChartJS<'radar'>['options'] = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: window.innerWidth < 640 ? 1 : 1.4,
      layout: {
        padding: { top: 8, right: 8, bottom: 8, left: 8 },
      },
      scales: {
        r: {
          min: 0,
          max: 1,
          beginAtZero: true,
          ticks: {
            stepSize: 0.2,
            color: '#9895a8',
            font: { size: 10 },
            backdropColor: 'transparent',
            showLabelBackdrop: false,
          },
          grid: {
            color: '#2a2745',
            lineWidth: 1,
          },
          angleLines: {
            color: '#2a2745',
            lineWidth: 1,
          },
          pointLabels: {
            color: '#c0bdd0',
            font: {
              size: window.innerWidth < 640 ? 11 : 13,
              weight: 'normal' as const,
            },
            padding: 12,
          },
        },
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: 'rgba(30, 28, 50, 0.95)',
          titleColor: '#e2e0f0',
          bodyColor: '#c0bdd0',
          borderColor: '#3d3a5c',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 12,
          titleFont: { size: 13, weight: 'bold' as const },
          bodyFont: { size: 12 },
          callbacks: {
            title(items) {
              const item = items[0];
              if (!item) return '';
              return item.label;
            },
            label(item) {
              const value = item.raw as number;
              return `平均置信度: ${(value * 100).toFixed(1)}%`;
            },
          },
        },
      },
    }),
    []
  );

  // 空状态
  if (!data || analyzedSongs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 rounded-xl bg-vw-bg-card border border-[#2a2745]">
        <svg
          className="w-16 h-16 mb-4 text-[#9895a8] opacity-40"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
          />
        </svg>
        <p className="text-vw-text text-sm opacity-60 text-center">
          暂无已分析的歌曲数据
        </p>
        <p className="text-[#9895a8] text-xs mt-1 text-center">
          分析歌曲后，情绪雷达图将在此显示
        </p>
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl bg-vw-bg-card border border-[#2a2745] p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-vw-text text-base font-medium">
          情绪雷达图
        </h3>
        {dominantEmotion && (
          <span
            className="text-xs px-3 py-1 rounded-full font-medium"
            style={{
              backgroundColor: `${DIMENSION_COLORS[dominantEmotion]?.border || '#9895a8'}20`,
              color: DIMENSION_COLORS[dominantEmotion]?.border || '#9895a8',
              border: `1px solid ${DIMENSION_COLORS[dominantEmotion]?.border || '#9895a8'}40`,
            }}
          >
            主导情绪: {dominantEmotion}
          </span>
        )}
      </div>
      <div className="w-full max-w-lg mx-auto">
        <Radar data={data} options={options} />
      </div>
      {/* 情绪图例 */}
      <div className="flex flex-wrap justify-center gap-3 mt-4">
        {EMOTION_DIMENSIONS.map((emotion) => (
          <div key={emotion} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{
                backgroundColor: DIMENSION_COLORS[emotion]?.border || '#9895a8',
              }}
            />
            <span className="text-[#9895a8] text-xs">{emotion}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
