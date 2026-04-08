import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getUserFromRequest } from '../_shared/auth.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const AI_PROVIDER = Deno.env.get('AI_PROVIDER') || 'nvidia';
const OPENAI_API_KEY = Deno.env.get('NVIDIA_API_KEY') || Deno.env.get('OPENAI_API_KEY') || '';
const OPENAI_BASE_URL = Deno.env.get('NVIDIA_BASE_URL') || Deno.env.get('OPENAI_BASE_URL') || 'https://integrate.api.nvidia.com/v1';
const OPENAI_MODEL = Deno.env.get('NVIDIA_MODEL') || Deno.env.get('OPENAI_MODEL') || 'nvidia/llama-3.1-nemotron-70b-instruct';

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 1000;

interface SongRow {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  lyrics: string | null;
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { userId, error: authError } = await getUserFromRequest(req);
    if (authError) {
      return new Response(JSON.stringify({ error: authError }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { playlist_id } = await req.json();
    if (!playlist_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: playlist_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Verify playlist belongs to user
    const playlistCheck = await fetch(
      `${SUPABASE_URL}/rest/v1/playlists?id=eq.${playlist_id}&select=id,user_id,status`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      },
    );

    if (!playlistCheck.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to verify playlist' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const playlists = await playlistCheck.json() as Array<{ id: string; user_id: string; status: string }>;
    if (playlists.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Playlist not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (playlists[0].user_id !== userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: playlist does not belong to user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Update playlist status to analyzing
    await fetch(`${SUPABASE_URL}/rest/v1/playlists?id=eq.${playlist_id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ status: 'analyzing' }),
    });

    // Fetch all pending songs for this playlist
    const songsResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/songs?playlist_id=eq.${playlist_id}&analysis_status=in.(pending,failed)&select=id,title,artist,album,lyrics`,
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

    const songs = await songsResponse.json() as SongRow[];

    if (songs.length === 0) {
      // No songs to analyze, mark as completed
      await fetch(`${SUPABASE_URL}/rest/v1/playlists?id=eq.${playlist_id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        body: JSON.stringify({ status: 'completed' }),
      });

      return new Response(
        JSON.stringify({ success: true, message: 'No pending songs to analyze', total: 0, analyzed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Process songs in batches
    let analyzedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < songs.length; i += BATCH_SIZE) {
      const batch = songs.slice(i, i + BATCH_SIZE);

      // Process batch in parallel (within the batch)
      const results = await Promise.allSettled(
        batch.map((song) => analyzeSingleSong(song)),
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          analyzedCount++;
        } else {
          failedCount++;
        }
      }

      // Update playlist analyzed_count
      await fetch(`${SUPABASE_URL}/rest/v1/playlists?id=eq.${playlist_id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        body: JSON.stringify({ analyzed_count: analyzedCount }),
      });

      // Delay between batches (skip delay for the last batch)
      if (i + BATCH_SIZE < songs.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    // Update final playlist status
    const finalStatus = failedCount === 0 ? 'completed' : 'completed_with_errors';
    await fetch(`${SUPABASE_URL}/rest/v1/playlists?id=eq.${playlist_id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({
        status: finalStatus,
        analyzed_count: analyzedCount,
      }),
    });

    return new Response(
      JSON.stringify({
        success: true,
        total: songs.length,
        analyzed: analyzedCount,
        failed: failedCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('analyze-batch error:', error);

    // Try to update playlist status to failed
    try {
      const body = await req.clone().json();
      if (body.playlist_id) {
        await fetch(`${SUPABASE_URL}/rest/v1/playlists?id=eq.${body.playlist_id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
          body: JSON.stringify({ status: 'failed' }),
        });
      }
    } catch {}

    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

async function analyzeSingleSong(song: SongRow): Promise<boolean> {
  try {
    // Call AI for analysis
    const systemPrompt = '你是音乐情绪分析师，擅长从歌词和元数据中解读情感。仅输出纯净JSON。';
    const userPrompt = buildAnalysisPrompt(song);

    const aiResult = await callOpenAI(systemPrompt, userPrompt);
    const analysis = parseAnalysis(aiResult);

    // Store analysis result
    const storeResponse = await fetch(`${SUPABASE_URL}/rest/v1/vibe_analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        song_id: song.id,
        valence: analysis.valence,
        arousal: analysis.arousal,
        emotion_confidence: analysis.emotion_confidence,
        vibe_tags: analysis.vibe_tags,
        reasoning: analysis.reasoning,
        model_version: OPENAI_MODEL,
      }),
    });

    if (!storeResponse.ok) {
      console.error(`Failed to store analysis for song ${song.id}:`, await storeResponse.text());
    }

    // Update song status to completed
    await fetch(`${SUPABASE_URL}/rest/v1/songs?id=eq.${song.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ analysis_status: 'completed', analysis_error: null }),
    });

    return true;
  } catch (error) {
    console.error(`Failed to analyze song ${song.id}:`, error);

    // Update song status to failed
    await fetch(`${SUPABASE_URL}/rest/v1/songs?id=eq.${song.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ analysis_status: 'failed', analysis_error: String(error) }),
    });

    return false;
  }
}

function buildAnalysisPrompt(song: SongRow): string {
  return `【任务】分析歌曲情绪，输出严格JSON格式
【输入】{"title":"${song.title}","artist":"${song.artist}","album":"${song.album || '未知'}","lyrics":"${(song.lyrics || '').slice(0, 2000).replace(/"/g, '\\"').replace(/\n/g, '\\n')}"}
【输出格式】{"valence":0.75,"arousal":0.60,"emotion_confidence":{"快乐":0.85},"vibe_tags":{"城市漫步":0.80},"reasoning":"简短说明"}
【约束】1.仅JSON 2.valence/arousal:-1~1 3.保留>=0.3的标签 4.reasoning中文20-50字`;
}

async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const requestBody: Record<string, unknown> = {
    model: OPENAI_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.2,
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

function parseAnalysis(raw: string) {
  let json = raw.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  try {
    const d = JSON.parse(json);
    return {
      valence: Math.round(Math.min(1, Math.max(-1, parseFloat(d.valence) || 0)) * 100) / 100,
      arousal: Math.round(Math.min(1, Math.max(-1, parseFloat(d.arousal) || 0)) * 100) / 100,
      emotion_confidence: Object.fromEntries(
        Object.entries(d.emotion_confidence || {})
          .filter(([, v]) => parseFloat(v as string) >= 0.3)
          .map(([k, v]) => [k, Math.round(parseFloat(v as string) * 100) / 100]),
      ),
      vibe_tags: Object.fromEntries(
        Object.entries(d.vibe_tags || {})
          .filter(([, v]) => parseFloat(v as string) >= 0.3)
          .map(([k, v]) => [k, Math.round(parseFloat(v as string) * 100) / 100]),
      ),
      reasoning: String(d.reasoning || '').slice(0, 200),
    };
  } catch {
    return { valence: 0, arousal: 0, emotion_confidence: {}, vibe_tags: {}, reasoning: '解析失败' };
  }
}
