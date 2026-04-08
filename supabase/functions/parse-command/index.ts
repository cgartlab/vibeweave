import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getUserFromRequest } from '../_shared/auth.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const AI_PROVIDER = Deno.env.get('AI_PROVIDER') || 'nvidia';
const OPENAI_API_KEY = Deno.env.get('NVIDIA_API_KEY') || Deno.env.get('OPENAI_API_KEY') || '';
const OPENAI_BASE_URL = Deno.env.get('NVIDIA_BASE_URL') || Deno.env.get('OPENAI_BASE_URL') || 'https://integrate.api.nvidia.com/v1';
const OPENAI_MODEL = Deno.env.get('NVIDIA_MODEL') || Deno.env.get('OPENAI_MODEL') || 'nvidia/llama-3.1-nemotron-70b-instruct';

interface SongWithAnalysis {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  valence: number | null;
  arousal: number | null;
  emotion_confidence: Record<string, number> | null;
  vibe_tags: Record<string, number> | null;
  reasoning: string | null;
}

interface CommandResult {
  sorted_ids: string[];
  filtered_ids?: string[];
  note: string;
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { userId, error: authError } = await getUserFromRequest(req);
    if (authError) {
      return new Response(JSON.stringify({ error: authError }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { command, playlist_id } = await req.json();
    if (!command || !playlist_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: command, playlist_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Verify playlist belongs to user
    const playlistCheck = await fetch(
      `${SUPABASE_URL}/rest/v1/playlists?id=eq.${playlist_id}&select=id,user_id`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      },
    );

    if (!playlistCheck.ok || !(await playlistCheck.json() as Array<{ id: string; user_id: string }>).length) {
      return new Response(
        JSON.stringify({ error: 'Playlist not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const [playlist] = await playlistCheck.json() as Array<{ id: string; user_id: string }>;
    if (playlist.user_id !== userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: playlist does not belong to user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Fetch all songs with their analysis data
    const songsResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/songs?playlist_id=eq.${playlist_id}&select=id,title,artist,album,vibe_analysis(valence,arousal,emotion_confidence,vibe_tags,reasoning)&order=sort_order.asc`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      },
    );

    if (!songsResponse.ok) {
      throw new Error(`Failed to fetch songs: ${songsResponse.status}`);
    }

    const rawSongs = await songsResponse.json() as Array<{
      id: string;
      title: string;
      artist: string;
      album: string | null;
      vibe_analysis: Array<{
        valence: number | null;
        arousal: number | null;
        emotion_confidence: Record<string, number> | null;
        vibe_tags: Record<string, number> | null;
        reasoning: string | null;
      } | null>;
    }>;

    // Flatten analysis data (take the latest analysis per song)
    const songs: SongWithAnalysis[] = rawSongs.map((s) => {
      const analysis = s.vibe_analysis?.[0] || null;
      return {
        id: s.id,
        title: s.title,
        artist: s.artist,
        album: s.album,
        valence: analysis?.valence ?? null,
        arousal: analysis?.arousal ?? null,
        emotion_confidence: analysis?.emotion_confidence ?? null,
        vibe_tags: analysis?.vibe_tags ?? null,
        reasoning: analysis?.reasoning ?? null,
      };
    });

    const analyzedSongs = songs.filter((s) => s.valence !== null);
    const unanalyzedCount = songs.length - analyzedSongs.length;

    if (analyzedSongs.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'No analyzed songs in this playlist. Please run batch analysis first.',
          unanalyzed_count: unanalyzedCount,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Build context for AI
    const context = buildSongContext(analyzedSongs);

    // Call AI to parse the command
    const systemPrompt = `你是VibeWeave音乐播放列表智能助手。用户会用自然语言描述他们想要的音乐排序或筛选方式。
你需要根据歌曲的情绪分析数据（valence效价、arousal唤醒度、情绪标签、氛围标签）来理解和执行用户的指令。

【你的能力】
1. 排序：根据情绪维度或氛围对歌曲重新排序
2. 筛选：根据条件筛选出符合条件的歌曲子集
3. 同时排序和筛选

【输出格式】严格输出JSON，不要任何其他内容：
{"sorted_ids":["歌曲ID按顺序排列"],"filtered_ids":["筛选出的歌曲ID，如果没有筛选则省略此字段"],"note":"简要说明你做了什么"}

【重要规则】
- sorted_ids 必须包含所有已分析的歌曲ID（如果同时有筛选则只包含筛选后的）
- filtered_ids 仅在用户要求筛选时出现
- note 用中文简要说明操作结果
- 如果指令不明确，做最合理的推断`;

    const userPrompt = `【用户指令】${command}

【歌曲数据】
${context}

请根据用户指令处理这些歌曲，输出JSON结果。`;

    const aiResult = await callOpenAI(systemPrompt, userPrompt);
    const result = parseCommandResult(aiResult, songs);

    return new Response(
      JSON.stringify({
        success: true,
        ...result,
        total_songs: songs.length,
        analyzed_songs: analyzedSongs.length,
        unanalyzed_songs: unanalyzedCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('parse-command error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

/**
 * Build a compact context string of all songs for the AI prompt
 */
function buildSongContext(songs: SongWithAnalysis[]): string {
  return songs.map((s, index) => {
    const emotions = s.emotion_confidence
      ? Object.entries(s.emotion_confidence).map(([k, v]) => `${k}:${v}`).join(',')
      : '无';
    const vibes = s.vibe_tags
      ? Object.entries(s.vibe_tags).map(([k, v]) => `${k}:${v}`).join(',')
      : '无';

    return `[${index}] ID:${s.id} | ${s.title} - ${s.artist} | valence:${s.valence} arousal:${s.arousal} | 情绪:${emotions} | 氛围:${vibes}`;
  }).join('\n');
}

/**
 * Parse and validate the AI command result
 */
function parseCommandResult(raw: string, allSongs: SongWithAnalysis[]): CommandResult {
  let json = raw.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');

  try {
    const d = JSON.parse(json);
    const allIds = new Set(allSongs.map((s) => s.id));

    // Validate sorted_ids
    let sortedIds: string[] = Array.isArray(d.sorted_ids)
      ? d.sorted_ids.filter((id: string) => allIds.has(id))
      : allSongs.map((s) => s.id);

    // Ensure all analyzed songs are included in sorted_ids
    const missingIds = allSongs
      .filter((s) => !sortedIds.includes(s.id))
      .map((s) => s.id);
    sortedIds = [...sortedIds, ...missingIds];

    // Validate filtered_ids (optional)
    let filteredIds: string[] | undefined;
    if (Array.isArray(d.filtered_ids) && d.filtered_ids.length > 0) {
      filteredIds = d.filtered_ids.filter((id: string) => allIds.has(id));
      if (filteredIds.length === 0) filteredIds = undefined;
    }

    return {
      sorted_ids: sortedIds,
      filtered_ids: filteredIds,
      note: String(d.note || '指令已执行'),
    };
  } catch {
    // Fallback: return original order
    return {
      sorted_ids: allSongs.map((s) => s.id),
      note: '无法解析指令，保持原始顺序',
    };
  }
}

async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const requestBody: Record<string, unknown> = {
    model: OPENAI_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
  };

  // Only add response_format for non-NVIDIA providers by default;
  // NVIDIA may not support response_format for all models
  if (AI_PROVIDER !== 'nvidia') {
    requestBody.response_format = { type: 'json_object' };
  }

  let response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(requestBody),
  });

  // If NVIDIA (or any provider) returns 400 with response_format, retry without it
  if (!response.ok && response.status === 400 && requestBody.response_format) {
    console.warn('response_format not supported, retrying without it');
    delete requestBody.response_format;
    // Add JSON instruction to system prompt
    requestBody.messages = [
      { role: 'system', content: systemPrompt + '\n\nIMPORTANT: Output only valid JSON, no markdown or explanation.' },
      { role: 'user', content: userPrompt },
    ];
    response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });
  }

  if (!response.ok) throw new Error(`OpenAI error: ${response.status}`);
  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}
