import { describe, it, expect } from 'vitest';
import { parseAnalysisResponse, parseCommandResponse, normalizeEmotionLabels } from './parser';

describe('normalizeEmotionLabels', () => {
  it('should map synonyms to standard labels', () => {
    const input = { '开心': 0.8, '难过': 0.6, '轻松': 0.7 };
    const result = normalizeEmotionLabels(input);
    expect(result).toEqual({ '快乐': 0.8, '悲伤': 0.6, '放松': 0.7 });
  });

  it('should keep unmapped labels unchanged', () => {
    const input = { '神秘': 0.5 };
    const result = normalizeEmotionLabels(input);
    expect(result).toEqual({ '神秘': 0.5 });
  });

  it('should merge synonyms and take highest confidence', () => {
    const input = { '开心': 0.8, '快乐': 0.9 };
    const result = normalizeEmotionLabels(input);
    expect(result).toEqual({ '快乐': 0.9 });
  });
});

describe('parseAnalysisResponse', () => {
  it('should parse valid JSON response', () => {
    const input = JSON.stringify({
      valence: 0.75,
      arousal: 0.6,
      emotion_confidence: { '快乐': 0.85, '悲伤': 0.2 },
      vibe_tags: { '城市漫步': 0.8 },
      reasoning: '这是一首快乐的歌',
    });
    const result = parseAnalysisResponse(input);
    expect(result.valence).toBe(0.75);
    expect(result.arousal).toBe(0.6);
    expect(result.emotion_confidence).toEqual({ '快乐': 0.85 });
    expect(result.vibe_tags).toEqual({ '城市漫步': 0.8 });
    expect(result.reasoning).toBe('这是一首快乐的歌');
  });

  it('should handle markdown code blocks', () => {
    const input = '```json\n{"valence":0.5,"arousal":0.3}\n```';
    const result = parseAnalysisResponse(input);
    expect(result.valence).toBe(0.5);
    expect(result.arousal).toBe(0.3);
  });

  it('should clamp valence and arousal to [-1, 1]', () => {
    const input = JSON.stringify({ valence: 1.5, arousal: -2 });
    const result = parseAnalysisResponse(input);
    expect(result.valence).toBe(1);
    expect(result.arousal).toBe(-1);
  });

  it('should return fallback on parse error', () => {
    const result = parseAnalysisResponse('invalid json');
    expect(result).toEqual({
      valence: 0,
      arousal: 0,
      emotion_confidence: {},
      vibe_tags: {},
      reasoning: '分析结果解析失败，请重试',
    });
  });
});

describe('parseCommandResponse', () => {
  it('should parse valid command response', () => {
    const input = JSON.stringify({
      sorted_ids: ['song1', 'song2', 'song3'],
      filtered_ids: ['song1', 'song2'],
      note: '已调整顺序',
    });
    const result = parseCommandResponse(input);
    expect(result.sorted_ids).toEqual(['song1', 'song2', 'song3']);
    expect(result.filtered_ids).toEqual(['song1', 'song2']);
    expect(result.note).toBe('已调整顺序');
  });

  it('should handle missing filtered_ids', () => {
    const input = JSON.stringify({ sorted_ids: ['a', 'b'], note: 'done' });
    const result = parseCommandResponse(input);
    expect(result.filtered_ids).toBeUndefined();
  });

  it('should return fallback on parse error', () => {
    const result = parseCommandResponse('invalid');
    expect(result.sorted_ids).toEqual([]);
    expect(result.note).toBe('指令解析失败，请尝试更清晰的描述');
  });
});