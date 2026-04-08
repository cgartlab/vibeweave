import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getUserFromRequest } from '../_shared/auth.ts';

const AI_PROVIDER = Deno.env.get('AI_PROVIDER') || 'nvidia';
const OPENAI_API_KEY = Deno.env.get('NVIDIA_API_KEY') || Deno.env.get('OPENAI_API_KEY') || '';
const OPENAI_BASE_URL = Deno.env.get('NVIDIA_BASE_URL') || Deno.env.get('OPENAI_BASE_URL') || 'https://integrate.api.nvidia.com/v1';
const OPENAI_MODEL = Deno.env.get('NVIDIA_MODEL') || Deno.env.get('OPENAI_MODEL') || 'nvidia/llama-3.1-nemotron-70b-instruct';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

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

    const { song_id, title, artist, album, lyrics } = await req.json();
    if (!song_id || !title || !artist) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: song_id, title, artist' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Call AI for analysis
    const systemPrompt = '你是音乐情绪分析师，擅长从歌词和元数据中解读情感。仅输出纯净JSON。';
    const userPrompt = buildAnalysisPrompt({ title, artist, album, lyrics });

    const aiResult = await callOpenAI(systemPrompt, userPrompt);
    const analysis = parseAnalysis(aiResult);

    // Store result using Supabase REST API
    const storeResponse = await fetch(`${SUPABASE_URL}/rest/v1/vibe_analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        song_id,
        valence: analysis.valence,
        arousal: analysis.arousal,
        emotion_confidence: analysis.emotion_confidence,
        vibe_tags: analysis.vibe_tags,
        reasoning: analysis.reasoning,
        model_version: OPENAI_MODEL,
      }),
    });

    if (!storeResponse.ok) {
      const error = await storeResponse.text();
      console.error('Failed to store analysis:', error);
    }

    // Update song analysis_status
    await fetch(`${SUPABASE_URL}/rest/v1/songs?id=eq.${song_id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ analysis_status: 'completed', analysis_error: null }),
    });

    return new Response(
      JSON.stringify({ success: true, analysis }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('analyze-song error:', error);

    // Update song status to failed if we have the song_id
    try {
      const body = await req.clone().json();
      if (body.song_id) {
        await fetch(`${SUPABASE_URL}/rest/v1/songs?id=eq.${body.song_id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
          body: JSON.stringify({ analysis_status: 'failed', analysis_error: String(error) }),
        });
      }
    } catch {}

    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

function buildAnalysisPrompt(input: { title: string; artist: string; album: string; lyrics?: string }): string {
  return `【任务】分析歌曲情绪，输出严格JSON格式
【输入】{"title":"${input.title}","artist":"${input.artist}","album":"${input.album || '未知'}","lyrics":"${(input.lyrics || '').slice(0, 2000).replace(/"/g, '\\"').replace(/\n/g, '\\n')}"}
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
