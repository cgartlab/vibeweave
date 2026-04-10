import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getUserFromRequest } from '../_shared/auth.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// NetEase Open Platform API credentials (optional, for official API)
const NETEASE_APP_ID = Deno.env.get('NETEASE_APP_ID') || '';
const NETEASE_APP_SECRET = Deno.env.get('NETEASE_APP_SECRET') || '';
const NETEASE_PRIVATE_KEY = Deno.env.get('NETEASE_PRIVATE_KEY') || '';
const hasNetEaseOpenPlatform = !!(NETEASE_APP_ID && NETEASE_PRIVATE_KEY);

// NetEase Cloud Music API endpoints
const NETEASE_API_BASE = 'https://music.163.com/api';
const NETEASE_OPEN_API_BASE = 'https://interface.music.163.com/api';

interface NetEaseSong {
  id: number;
  name: string;
  artists: Array<{ id: number; name: string }>;
  album: { id: number; name: string; picUrl?: string };
  duration?: number;
}

interface NetEasePlaylistDetail {
  playlist: {
    id: number;
    name: string;
    description?: string;
    coverImgUrl?: string;
    trackIds: Array<{ id: number; v?: number }>;
    tracks: NetEaseSong[];
  };
}

interface NetEaseSongDetail {
  songs: NetEaseSong[];
  lyrics?: Array<{ lrc?: { lyric?: string } }>;
}

/**
 * Sign parameters for NetEase Open Platform API using SHA256WithRSA (Web Crypto API)
 */
async function signNetEaseOpenParams(params: Record<string, string>, privateKeyPem: string): Promise<Record<string, string>> {
  const timestamp = String(Date.now());
  const allParams: Record<string, string> = { ...params, appid: NETEASE_APP_ID, timestamp, sign_type: 'RSA' };

  // Sort keys alphabetically
  const sortedKeys = Object.keys(allParams).sort();
  const signString = sortedKeys.map(k => `${k}=${allParams[k]}`).join('&');

  // Import private key and sign using Web Crypto API
  const pemContents = privateKeyPem
    .replace('-----BEGIN RSA PRIVATE KEY-----', '')
    .replace('-----END RSA PRIVATE KEY-----', '')
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');

  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const encoder = new TextEncoder();
  const data = encoder.encode(signString);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, data);
  const signBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

  allParams.sign = signBase64;
  return allParams;
}

/**
 * Fetch playlist detail from NetEase Open Platform (official API with signing)
 */
async function fetchNetEaseOpenPlaylist(playlistId: string): Promise<NetEasePlaylistDetail> {
  const signedParams = await signNetEaseOpenParams(
    { id: playlistId, n: '100000' },
    NETEASE_PRIVATE_KEY,
  );

  const searchParams = new URLSearchParams(signedParams);
  const response = await fetch(`${NETEASE_OPEN_API_BASE}/v6/playlist/detail?${searchParams.toString()}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://music.163.com/',
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`NetEase Open API error: ${response.status}`);
  }

  return await response.json() as NetEasePlaylistDetail;
}

/**
 * Fetch song lyrics from NetEase Open Platform (official API with signing)
 */
async function fetchNetEaseOpenLyrics(songId: number): Promise<string | null> {
  try {
    const signedParams = await signNetEaseOpenParams(
      { id: String(songId), lv: '1' },
      NETEASE_PRIVATE_KEY,
    );

    const searchParams = new URLSearchParams(signedParams);
    const response = await fetch(`${NETEASE_OPEN_API_BASE}/v3/song/lyric?${searchParams.toString()}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://music.163.com/',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) return null;

    const data = await response.json() as { lrc?: { lyric?: string } };
    return data.lrc?.lyric || null;
  } catch {
    return null;
  }
}

/**
 * Extract playlist ID from various NetEase URL formats:
 * - https://music.163.com/#/playlist?id=12345
 * - https://music.163.com/playlist/12345
 * - https://music.163.com/#/discover/toplist?id=12345
 * - Just a numeric ID string
 */
function extractPlaylistId(url: string): string | null {
  // Direct numeric ID
  if (/^\d+$/.test(url.trim())) {
    return url.trim();
  }

  // URL patterns
  const patterns = [
    /music\.163\.com\/.*[?&]id=(\d+)/,
    /music\.163\.com\/playlist\/(\d+)/,
    /music\.163\.com\/#\/playlist\?id=(\d+)/,
    /music\.163\.com\/#\/discover\/toplist\?id=(\d+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Fetch playlist detail from NetEase API
 * If NetEase Open Platform credentials are configured, tries the official API first;
 * falls back to the non-official API on failure.
 */
async function fetchNetEasePlaylist(playlistId: string): Promise<NetEasePlaylistDetail> {
  // Try official Open Platform API first if credentials are available
  if (hasNetEaseOpenPlatform) {
    try {
      console.log('Attempting to fetch playlist via NetEase Open Platform API');
      return await fetchNetEaseOpenPlaylist(playlistId);
    } catch (error) {
      console.warn('NetEase Open Platform API failed, falling back to non-official API:', error);
    }
  }

  // Fallback: non-official API
  const response = await fetch(`${NETEASE_API_BASE}/v6/playlist/detail?id=${playlistId}&n=100000`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://music.163.com/',
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`NetEase API error: ${response.status}`);
  }

  return await response.json() as NetEasePlaylistDetail;
}

/**
 * Fetch song lyrics from NetEase API
 * If NetEase Open Platform credentials are configured, tries the official API first;
 * falls back to the non-official API on failure.
 */
async function fetchNetEaseLyrics(songId: number): Promise<string | null> {
  // Try official Open Platform API first if credentials are available
  if (hasNetEaseOpenPlatform) {
    try {
      const result = await fetchNetEaseOpenLyrics(songId);
      if (result) return result;
    } catch {
      // Fall through to non-official API
    }
  }

  // Fallback: non-official API
  try {
    const response = await fetch(`${NETEASE_API_BASE}/v3/song/lyric?id=${songId}&lv=1`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://music.163.com/',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) return null;

    const data = await response.json() as { lrc?: { lyric?: string } };
    return data.lrc?.lyric || null;
  } catch {
    return null;
  }
}

/**
 * Parse NetEase LRC format lyrics to plain text
 */
function parseLrcLyrics(lrcContent: string): string {
  const lines = lrcContent.split('\n');
  const textLines: string[] = [];

  for (const line of lines) {
    // Remove LRC time tags like [00:12.34]
    const text = line.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '').trim();
    // Skip empty lines and metadata lines
    if (text && !text.startsWith('[ti:') && !text.startsWith('[ar:') && !text.startsWith('[al:')) {
      textLines.push(text);
    }
  }

  return textLines.join('\n');
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

    const { url } = await req.json();
    if (!url) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: url' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Extract and validate playlist ID
    const playlistId = extractPlaylistId(url);
    if (!playlistId) {
      return new Response(
        JSON.stringify({ error: 'Invalid playlist URL. Supported formats: NetEase Cloud Music playlist links or numeric IDs.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Fetch playlist from NetEase
    const playlistData = await fetchNetEasePlaylist(playlistId);
    const playlist = playlistData.playlist;

    if (!playlist || !playlist.tracks || playlist.tracks.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Playlist is empty or could not be fetched' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Create playlist record in database
    const playlistResponse = await fetch(`${SUPABASE_URL}/rest/v1/playlists`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        user_id: userId,
        platform_playlist_id: playlistId,
        name: playlist.name,
        description: playlist.description || null,
        source_url: url,
        cover_url: playlist.coverImgUrl || null,
        total_count: playlist.tracks.length,
        status: 'fetched',
      }),
    });

    if (!playlistResponse.ok) {
      const errorText = await playlistResponse.text();
      console.error('Failed to create playlist:', errorText);
      throw new Error(`Failed to create playlist: ${playlistResponse.status}`);
    }

    const createdPlaylists = await playlistResponse.json() as Array<{ id: string }>;
    const dbPlaylistId = createdPlaylists[0].id;

    // Fetch lyrics for the first 20 songs (to keep response fast)
    const LYRICS_FETCH_LIMIT = 20;
    const lyricsMap = new Map<number, string | null>();

    const lyricsPromises = playlist.tracks.slice(0, LYRICS_FETCH_LIMIT).map(async (track) => {
      try {
        const lrcContent = await fetchNetEaseLyrics(track.id);
        if (lrcContent) {
          lyricsMap.set(track.id, parseLrcLyrics(lrcContent));
        } else {
          lyricsMap.set(track.id, null);
        }
      } catch {
        lyricsMap.set(track.id, null);
      }
    });

    await Promise.all(lyricsPromises);
    console.log(`Fetched lyrics for ${lyricsMap.size} songs (limit: ${LYRICS_FETCH_LIMIT})`);

    // Insert songs in batches of 50
    const BATCH_SIZE = 50;
    let insertedCount = 0;

    for (let i = 0; i < playlist.tracks.length; i += BATCH_SIZE) {
      const batch = playlist.tracks.slice(i, i + BATCH_SIZE);

      const songRows = batch.map((track, index) => ({
        playlist_id: dbPlaylistId,
        platform_song_id: String(track.id),
        title: track.name,
        artist: track.artists.map((a) => a.name).join(' / '),
        album: track.album?.name || null,
        duration: track.duration ? Math.round(track.duration / 1000) : null,
        sort_order: i + index,
        analysis_status: 'pending' as const,
        lyrics: lyricsMap.get(track.id) ?? null,
      }));

      const songsResponse = await fetch(`${SUPABASE_URL}/rest/v1/songs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify(songRows),
      });

      if (!songsResponse.ok) {
        console.error(`Failed to insert song batch starting at ${i}:`, await songsResponse.text());
      } else {
        insertedCount += songRows.length;
      }
    }

    // Update playlist with final count
    await fetch(`${SUPABASE_URL}/rest/v1/playlists?id=eq.${dbPlaylistId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ total_count: insertedCount }),
    });

    return new Response(
      JSON.stringify({
        success: true,
        playlist_id: dbPlaylistId,
        name: playlist.name,
        total_songs: insertedCount,
        source: 'netease',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('fetch-playlist error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
