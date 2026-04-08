import type { SongAnalysisResult, CommandParseResult } from './types';

/**
 * 情绪标签标准化映射
 * 将常见的中文情绪同义词映射到标准标签
 * 标准标签: 快乐, 悲伤, 放松, 兴奋, 宁静, 紧张, 怀旧
 */
const EMOTION_LABEL_MAP: Record<string, string> = {
  // -> 快乐
  '开心': '快乐',
  '高兴': '快乐',
  '喜悦': '快乐',
  '欢快': '快乐',
  '愉快': '快乐',
  '欢乐': '快乐',
  '欣喜': '快乐',
  '快乐': '快乐',
  // -> 悲伤
  '难过': '悲伤',
  '忧伤': '悲伤',
  '哀伤': '悲伤',
  '伤感': '悲伤',
  '悲伤': '悲伤',
  '伤心': '悲伤',
  '心痛': '悲伤',
  '忧愁': '悲伤',
  '忧郁': '悲伤',
  // -> 放松
  '轻松': '放松',
  '舒适': '放松',
  '放松': '放松',
  '舒缓': '放松',
  '悠闲': '放松',
  '慵懒': '放松',
  // -> 兴奋
  '激动': '兴奋',
  '亢奋': '兴奋',
  '兴奋': '兴奋',
  '热情': '兴奋',
  '热血': '兴奋',
  '燃': '兴奋',
  // -> 宁静
  '平静': '宁静',
  '安静': '宁静',
  '宁静': '宁静',
  '淡然': '宁静',
  '祥和': '宁静',
  '安详': '宁静',
  // -> 紧张
  '焦虑': '紧张',
  '不安': '紧张',
  '紧张': '紧张',
  '恐惧': '紧张',
  '害怕': '紧张',
  '压迫': '紧张',
  // -> 怀旧
  '怀念': '怀旧',
  '回忆': '怀旧',
  '怀旧': '怀旧',
  '思念': '怀旧',
  '追忆': '怀旧',
};

/** 置信度过滤阈值 */
const CONFIDENCE_THRESHOLD = 0.3;

/** valence/arousal 值范围 */
const VALUE_MIN = -1;
const VALUE_MAX = 1;

/**
 * 标准化情绪标签：将同义词映射到标准标签
 * 如果标签不在映射表中，保持原样
 */
export function normalizeEmotionLabels(labels: Record<string, number>): Record<string, number> {
  const normalized: Record<string, number> = {};

  for (const [label, confidence] of Object.entries(labels)) {
    const standardLabel = EMOTION_LABEL_MAP[label];
    if (!standardLabel) {
      // 不在映射表中的标签，保留原样
      normalized[label] = confidence;
      continue;
    }

    // 如果标准化后的标签已存在，取较高的置信度
    if (normalized[standardLabel] !== undefined) {
      normalized[standardLabel] = Math.max(normalized[standardLabel], confidence);
    } else {
      normalized[standardLabel] = confidence;
    }
  }

  return normalized;
}

export function parseAnalysisResponse(raw: string): SongAnalysisResult {
  // Strip markdown code blocks if present
  let jsonStr = raw.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    const data = JSON.parse(jsonStr);

    // Clamp valence and arousal to valid range [-1, 1]
    const valence = clamp(parseFloat(data.valence) || 0, VALUE_MIN, VALUE_MAX);
    const arousal = clamp(parseFloat(data.arousal) || 0, VALUE_MIN, VALUE_MAX);

    // Filter emotion_confidence by threshold and normalize labels
    const emotion_confidence: Record<string, number> = {};
    if (data.emotion_confidence && typeof data.emotion_confidence === 'object') {
      const rawEmotions: Record<string, number> = {};
      for (const [key, value] of Object.entries(data.emotion_confidence)) {
        const v = parseFloat(value as string);
        if (!isNaN(v) && v >= CONFIDENCE_THRESHOLD) {
          rawEmotions[key] = Math.round(v * 100) / 100;
        }
      }
      // Normalize emotion labels (merge synonyms)
      const normalized = normalizeEmotionLabels(rawEmotions);
      Object.assign(emotion_confidence, normalized);
    }

    // Filter vibe_tags by threshold
    const vibe_tags: Record<string, number> = {};
    if (data.vibe_tags && typeof data.vibe_tags === 'object') {
      for (const [key, value] of Object.entries(data.vibe_tags)) {
        const v = parseFloat(value as string);
        if (!isNaN(v) && v >= CONFIDENCE_THRESHOLD) {
          vibe_tags[key] = Math.round(v * 100) / 100;
        }
      }
    }

    return {
      valence: Math.round(valence * 100) / 100,
      arousal: Math.round(arousal * 100) / 100,
      emotion_confidence,
      vibe_tags,
      reasoning: String(data.reasoning || '').slice(0, 200),
    };
  } catch {
    // Fallback for unparseable response
    return {
      valence: 0,
      arousal: 0,
      emotion_confidence: {},
      vibe_tags: {},
      reasoning: '分析结果解析失败，请重试',
    };
  }
}

export function parseCommandResponse(raw: string): CommandParseResult {
  let jsonStr = raw.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    const data = JSON.parse(jsonStr);
    return {
      sorted_ids: Array.isArray(data.sorted_ids) ? data.sorted_ids : [],
      filtered_ids: Array.isArray(data.filtered_ids) ? data.filtered_ids : undefined,
      note: String(data.note || '已调整歌单顺序'),
    };
  } catch {
    return {
      sorted_ids: [],
      note: '指令解析失败，请尝试更清晰的描述',
    };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
