import type { SongAnalysisInput, CommandContext } from './types';

/**
 * 情绪标签标准化映射表
 * 将常见的中文情绪同义词映射到标准标签
 * 标准标签: 快乐, 悲伤, 放松, 兴奋, 宁静, 紧张, 怀旧
 */
export const EMOTION_LABEL_STANDARDIZATION: Record<string, string> = {
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

/**
 * 推荐的 temperature 设置:
 * - 歌曲情绪分析 (buildSongAnalysisPrompt): temperature 0.2-0.3
 *   低温度确保情绪标签的一致性和可重复性
 * - 指令解析 (buildCommandParsePrompt): temperature 0.1-0.2
 *   低温度确保指令解析的精确性，避免创造性输出
 */

export function buildSongAnalysisPrompt(input: SongAnalysisInput): string {
  const hasLyrics = !!(input.lyrics && input.lyrics.trim().length > 0);

  return `【任务】分析歌曲情绪，输出严格JSON格式

【输入】
{
  "title": "${input.title}",
  "artist": "${input.artist}",
  "album": "${input.album || '未知'}",
  "lyrics": "${hasLyrics ? (input.lyrics || '').slice(0, 2000) : ''}"
}

【输出格式】（必须纯净JSON，无额外文字）
{
  "valence": 0.75,
  "arousal": 0.60,
  "emotion_confidence": {
    "快乐": 0.85,
    "放松": 0.70
  },
  "vibe_tags": {
    "城市漫步": 0.80,
    "学习专注": 0.65
  },
  "reasoning": "歌词意象阳光积极，节奏轻快"
}

【约束】
1. 仅输出JSON，不要Markdown代码块或解释
2. valence: -1.00(极度不悦) ~ 1.00(极度愉悦)，两位小数
3. arousal: -1.00(极度平静) ~ 1.00(极度激动)，两位小数
4. emotion_confidence: 情绪标签及置信度(0~1)，保留>=0.3的标签
5. vibe_tags: 场景氛围标签及匹配度(0~1)，保留>=0.3的标签
6. 标准情绪标签：快乐、悲伤、放松、兴奋、宁静、紧张、怀旧
7. 无歌词时，根据歌曲名、艺术家名和专辑名推断情绪，reasoning中注明"无歌词，基于元数据推断"
8. reasoning: 简短中文说明(20-50字)
9. 情绪标签必须使用标准标签，不要使用同义词（如用"快乐"而非"开心"，用"悲伤"而非"难过"）

${!hasLyrics ? `【重要】当前歌曲无歌词内容，请根据歌曲名"${input.title}"、艺术家"${input.artist}"和专辑"${input.album || '未知'}"推断情绪，reasoning中必须注明"无歌词，基于元数据推断"。` : ''}

【示例1 - 欢快/快乐】
输入: {title: "好日子", artist: "宋祖英", lyrics: "今天是个好日子，心想的事儿都能成..."}
输出: {"valence": 0.90, "arousal": 0.70, "emotion_confidence": {"快乐": 0.95, "兴奋": 0.60}, "vibe_tags": {"节日庆典": 0.90, "家庭聚会": 0.80}, "reasoning": "歌词充满喜庆氛围，表达对美好生活的赞美，情绪积极高昂"}

【示例2 - 悲伤/忧伤】
输入: {title: "后来", artist: "刘若英", lyrics: "后来，我总算学会了如何去爱，可惜你早已远去..."}
输出: {"valence": -0.40, "arousal": -0.20, "emotion_confidence": {"悲伤": 0.90, "怀旧": 0.80, "宁静": 0.40}, "vibe_tags": {"深夜独处": 0.85, "失恋疗愈": 0.80, "雨夜咖啡馆": 0.65}, "reasoning": "歌词表达对逝去爱情的遗憾与追忆，情绪低沉但平和，带有强烈的怀旧感"}

【示例3 - 兴奋/高能量】
输入: {title: "野狼Disco", artist: "宝石Gem", lyrics: "左边跟我一起画个龙，在你右边画一道彩虹..."}
输出: {"valence": 0.75, "arousal": 0.90, "emotion_confidence": {"兴奋": 0.95, "快乐": 0.70}, "vibe_tags": {"派对狂欢": 0.95, "健身运动": 0.80, "公路旅行": 0.60}, "reasoning": "节奏强烈动感，歌词充满活力与号召力，适合跳舞和运动场景"}

【示例4 - 怀旧/温暖】
输入: {title: "晴天", artist: "周杰伦", lyrics: "故事的小黄花..."}
输出: {"valence": 0.45, "arousal": 0.30, "emotion_confidence": {"怀旧": 0.90, "快乐": 0.55, "宁静": 0.50}, "vibe_tags": {"雨夜咖啡馆": 0.75, "深夜独处": 0.70}, "reasoning": "歌词充满青春回忆与淡淡忧伤，旋律温暖怀旧"}

【示例5 - 无歌词推断】
输入: {title: "Weightless", artist: "Marconi Union", lyrics: ""}
输出: {"valence": 0.20, "arousal": -0.80, "emotion_confidence": {"宁静": 0.95, "放松": 0.90}, "vibe_tags": {"冥想": 0.90, "深度睡眠": 0.85, "瑜伽": 0.75}, "reasoning": "无歌词，基于元数据推断。环境音乐经典之作，经科学验证可降低焦虑，极度平静"}`;
}

export function buildCommandParsePrompt(command: string, context: CommandContext): string {
  const songList = context.songs.map(s => ({
    id: s.id,
    title: s.title,
    valence: s.valence ?? null,
    arousal: s.arousal ?? null,
    topEmotion: s.topEmotion ?? '未分析',
  }));

  return `【当前歌单】(共${songList.length}首)
${JSON.stringify(songList, null, 2)}

【用户指令】${command}

【输出要求】纯JSON格式：
{
  "sorted_ids": ["歌曲ID按新顺序排列"],
  "filtered_ids": ["筛选后的歌曲ID，无筛选则省略此字段"],
  "note": "简要中文说明你做了什么调整"
}

【支持的指令类型】
- 排序：按情绪/愉悦度/唤醒度排序，渐变排列
- 筛选：保留/移除特定情绪标签的歌曲
- 调整：移动特定歌曲位置，添加过渡
- 创作：基于情绪创建新排列

【约束】
1. 仅输出JSON
2. sorted_ids必须包含所有歌曲ID（除非有筛选）
3. 如有filtered_ids，sorted_ids仅包含filtered_ids中的ID
4. 保持未分析歌曲的相对位置不变`;
}
