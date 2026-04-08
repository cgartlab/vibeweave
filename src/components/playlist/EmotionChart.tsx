import { useMemo } from 'react';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Scatter } from 'react-chartjs-2';

ChartJS.register(LinearScale, PointElement, Tooltip, Legend, Filler);

interface Song {
  id: string | number;
  title: string;
  artist: string;
  valence?: number;
  arousal?: number;
  emotion_confidence?: Record<string, number>;
}

interface EmotionChartProps {
  songs: Song[];
}

const EMOTION_COLORS: Record<string, string> = {
  快乐: '#ffd93d',
  悲伤: '#6c5ce7',
  放松: '#00b894',
  兴奋: '#ff6b6b',
  宁静: '#74b9ff',
  紧张: '#fd79a8',
  怀旧: '#e17055',
};

const EMOTION_LABELS = Object.keys(EMOTION_COLORS);

function getTopEmotion(confidence?: Record<string, number>): string {
  if (!confidence) return '未知';
  let topEmotion = '未知';
  let topScore = -1;
  for (const [emotion, score] of Object.entries(confidence)) {
    if (score > topScore) {
      topScore = score;
      topEmotion = emotion;
    }
  }
  return topEmotion;
}

// 自定义插件：绘制象限背景色和象限标签
const quadrantPlugin: ChartJS['plugins'][number] = {
  id: 'quadrantBackground',
  beforeDraw(chart) {
    const { ctx, chartArea, scales } = chart;
    if (!chartArea) return;

    const { left, top, right, bottom } = chartArea;
    const xScale = scales.x;
    const yScale = scales.y;

    // 获取原点位置
    const xCenter = xScale.getPixelForValue(0);
    const yCenter = yScale.getPixelForValue(0);

    // 象限背景色（非常微弱）
    const quadrantColors = [
      'rgba(108, 92, 231, 0.04)',  // 左上 - 悲伤-激动
      'rgba(255, 217, 61, 0.04)',   // 右上 - 快乐-兴奋
      'rgba(116, 185, 255, 0.04)',  // 左下 - 消极-低落
      'rgba(0, 184, 148, 0.04)',    // 右下 - 放松-平静
    ];

    // 绘制四个象限背景
    // 左上
    ctx.fillStyle = quadrantColors[0];
    ctx.fillRect(left, top, xCenter - left, yCenter - top);
    // 右上
    ctx.fillStyle = quadrantColors[1];
    ctx.fillRect(xCenter, top, right - xCenter, yCenter - top);
    // 左下
    ctx.fillStyle = quadrantColors[2];
    ctx.fillRect(left, yCenter, xCenter - left, bottom - yCenter);
    // 右下
    ctx.fillStyle = quadrantColors[3];
    ctx.fillRect(xCenter, yCenter, right - xCenter, bottom - yCenter);

    // 绘制象限标签
    ctx.save();
    ctx.font = '12px sans-serif';
    ctx.fillStyle = 'rgba(152, 149, 168, 0.5)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const labelPadding = 16;

    // 右上 - 快乐-兴奋
    ctx.fillText(
      '快乐-兴奋',
      (xCenter + right) / 2,
      top + labelPadding
    );
    // 左上 - 悲伤-激动
    ctx.fillText(
      '悲伤-激动',
      (left + xCenter) / 2,
      top + labelPadding
    );
    // 右下 - 放松-平静
    ctx.fillText(
      '放松-平静',
      (xCenter + right) / 2,
      bottom - labelPadding
    );
    // 左下 - 消极-低落
    ctx.fillText(
      '消极-低落',
      (left + xCenter) / 2,
      bottom - labelPadding
    );

    ctx.restore();
  },
};

export default function EmotionChart({ songs }: EmotionChartProps) {
  const analyzedSongs = useMemo(
    () => songs.filter((s) => s.valence != null && s.arousal != null),
    [songs]
  );

  const { datasets, legendLabels } = useMemo(() => {
    const groupedByEmotion: Record<string, { x: number; y: number; song: Song }[]> = {};

    for (const song of analyzedSongs) {
      const emotion = getTopEmotion(song.emotion_confidence);
      if (!groupedByEmotion[emotion]) {
        groupedByEmotion[emotion] = [];
      }
      groupedByEmotion[emotion].push({
        x: song.valence!,
        y: song.arousal!,
        song,
      });
    }

    const chartDatasets = Object.entries(groupedByEmotion).map(
      ([emotion, points]) => ({
        label: emotion,
        data: points.map((p) => ({ x: p.x, y: p.y, song: p.song })),
        backgroundColor:
          EMOTION_COLORS[emotion] || 'rgba(152, 149, 168, 0.6)',
        borderColor:
          EMOTION_COLORS[emotion] || 'rgba(152, 149, 168, 0.8)',
        borderWidth: 1.5,
        pointRadius: 6,
        pointHoverRadius: 9,
        pointHoverBorderWidth: 2,
        pointHoverBorderColor: '#ffffff',
      })
    );

    const labels: string[] = [];
    for (const emotion of EMOTION_LABELS) {
      if (groupedByEmotion[emotion]) {
        labels.push(emotion);
      }
    }

    return { datasets: chartDatasets, legendLabels: labels };
  }, [analyzedSongs]);

  const options: ChartJS<'scatter'>['options'] = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: window.innerWidth < 640 ? 1 : 1.6,
      layout: {
        padding: { top: 24, right: 12, bottom: 24, left: 12 },
      },
      scales: {
        x: {
          min: -1,
          max: 1,
          title: {
            display: true,
            text: '效价 (Valence)',
            color: '#9895a8',
            font: { size: 13, weight: 'normal' as const },
          },
          grid: {
            color: '#2a2745',
            lineWidth: 1,
          },
          ticks: {
            color: '#9895a8',
            font: { size: 11 },
            stepSize: 0.5,
          },
          border: {
            color: '#2a2745',
          },
        },
        y: {
          min: -1,
          max: 1,
          title: {
            display: true,
            text: '唤醒度 (Arousal)',
            color: '#9895a8',
            font: { size: 13, weight: 'normal' as const },
          },
          grid: {
            color: '#2a2745',
            lineWidth: 1,
          },
          ticks: {
            color: '#9895a8',
            font: { size: 11 },
            stepSize: 0.5,
          },
          border: {
            color: '#2a2745',
          },
        },
      },
      plugins: {
        legend: {
          display: true,
          position: 'bottom' as const,
          labels: {
            color: '#9895a8',
            font: { size: 12 },
            padding: 16,
            usePointStyle: true,
            pointStyle: 'circle',
            // 只显示存在的情绪
            filter: (item: { text?: string }) => {
              return legendLabels.includes(item.text || '');
            },
          },
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
              const raw = item.raw as { song?: Song };
              return raw.song?.title || '';
            },
            label(item) {
              const raw = item.raw as { song?: Song };
              const song = raw.song;
              if (!song) return '';
              const lines: string[] = [];
              lines.push(`艺术家: ${song.artist}`);
              lines.push(`效价: ${song.valence?.toFixed(2) ?? 'N/A'}`);
              lines.push(`唤醒度: ${song.arousal?.toFixed(2) ?? 'N/A'}`);
              const topEmotion = getTopEmotion(song.emotion_confidence);
              const confidence = song.emotion_confidence?.[topEmotion];
              lines.push(
                `情绪: ${topEmotion}${
                  confidence != null ? ` (${(confidence * 100).toFixed(0)}%)` : ''
                }`
              );
              return lines;
            },
          },
        },
      },
    }),
    [legendLabels]
  );

  // 空状态
  if (analyzedSongs.length === 0) {
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
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
        <p className="text-vw-text text-sm opacity-60 text-center">
          暂无已分析的歌曲数据
        </p>
        <p className="text-[#9895a8] text-xs mt-1 text-center">
          分析歌曲后，情绪分布散点图将在此显示
        </p>
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl bg-vw-bg-card border border-[#2a2745] p-4 sm:p-6">
      <h3 className="text-vw-text text-base font-medium mb-4">
        情绪分布散点图
      </h3>
      <div className="w-full max-w-2xl mx-auto">
        <Scatter data={{ datasets }} options={options} plugins={[quadrantPlugin]} />
      </div>
    </div>
  );
}
