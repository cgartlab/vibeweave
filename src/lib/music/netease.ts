import type {
  MusicPlatformAdapter,
  MusicPlatform,
  PlaylistMeta,
  SongInfo,
} from './types';
import { NetEaseCrypto } from './crypto';
import { NetEaseOpenSigner } from './crypto';

// ---------------------------------------------------------------------------
// Internal response shapes (only the fields we actually use)
// ---------------------------------------------------------------------------

interface NeteasePlaylistTrack {
  id: number;
  name: string;
  ar: { id: number; name: string }[];
  al: { id: number; name: string; picUrl?: string };
  dt: number; // duration in ms
}

interface NeteasePlaylistCreator {
  nickname: string;
}

interface NeteasePlaylistDetail {
  id: number;
  name: string;
  description: string | null;
  coverImgUrl: string;
  trackCount: number;
  trackIds: { id: number }[];
  tracks: NeteasePlaylistTrack[];
  creator: NeteasePlaylistCreator;
}

interface NeteasePlaylistResponse {
  code: number;
  playlist: NeteasePlaylistDetail;
}

interface NeteaseSongDetail {
  id: number;
  name: string;
  ar: { id: number; name: string }[];
  al: { id: number; name: string; picUrl?: string };
  dt: number;
}

interface NeteaseSongResponse {
  code: number;
  songs: NeteaseSongDetail[];
}

interface NeteaseLyricResponse {
  code: number;
  lrc?: { lyric: string };
  tlyric?: { lyric: string };
}

interface NeteaseSearchSong {
  id: number;
  name: string;
  artists: { id: number; name: string }[];
  album: { id: number; name: string; picUrl?: string };
  duration: number; // ms
}

interface NeteaseSearchResponse {
  code: number;
  result: {
    songs: NeteaseSearchSong[];
    songCount: number;
  };
}

// ---------------------------------------------------------------------------
// Open Platform API response shapes
// ---------------------------------------------------------------------------

interface OpenApiPlaylistTrack {
  id: number;
  name: string;
  ar: { id: number; name: string }[];
  al: { id: number; name: string; picUrl?: string };
  dt: number;
}

interface OpenApiPlaylistResponse {
  code: number;
  data?: {
    playlist?: {
      id: number;
      name: string;
      description: string | null;
      coverImgUrl: string;
      trackCount: number;
      tracks: OpenApiPlaylistTrack[];
      creator?: { nickname: string };
    };
  };
}

interface OpenApiSongResponse {
  code: number;
  data?: {
    songs?: OpenApiPlaylistTrack[];
  };
}

interface OpenApiLyricResponse {
  code: number;
  data?: {
    lrc?: { lyric: string };
    tlyric?: { lyric: string };
  };
}

interface OpenApiSearchResponse {
  code: number;
  data?: {
    result?: {
      songs: OpenApiPlaylistTrack[];
      songCount: number;
    };
  };
}

// ---------------------------------------------------------------------------
// Helper: build common headers
// ---------------------------------------------------------------------------

function buildHeaders(): Record<string, string> {
  return {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Referer: 'https://music.163.com/',
    Accept: '*/*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  };
}

// ---------------------------------------------------------------------------
// Helper: safe JSON fetch
// ---------------------------------------------------------------------------

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: buildHeaders(),
    credentials: 'omit',
  });

  if (!response.ok) {
    throw new Error(
      `NetEase API request failed: ${response.status} ${response.statusText} for ${url}`,
    );
  }

  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Helper: encrypted POST fetch
// ---------------------------------------------------------------------------

async function fetchEncrypted<T>(
  url: string,
  params: object,
): Promise<T> {
  const encrypted = NetEaseCrypto.encryptParams({
    ...params,
    csrf_token: '',
  });

  const formBody = new URLSearchParams();
  formBody.append('params', encrypted.params);
  formBody.append('encSecKey', encrypted.encSecKey);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...buildHeaders(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formBody.toString(),
    credentials: 'omit',
  });

  if (!response.ok) {
    throw new Error(
      `NetEase encrypted API request failed: ${response.status} ${response.statusText} for ${url}`,
    );
  }

  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Helper: normalise a single track into SongInfo
// ---------------------------------------------------------------------------

function normaliseTrack(track: NeteasePlaylistTrack | NeteaseSongDetail | OpenApiPlaylistTrack): SongInfo {
  return {
    platformSongId: String(track.id),
    title: track.name,
    artist: track.ar.map((a) => a.name).join(' / '),
    album: track.al.name,
    duration: Math.round(track.dt / 1000), // ms -> seconds
    coverUrl: track.al.picUrl ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// NetEaseAdapter (non-official API)
// ---------------------------------------------------------------------------

export class NetEaseAdapter implements MusicPlatformAdapter {
  readonly platform: MusicPlatform = 'netease';

  // ---- Playlist info -----------------------------------------------------

  async getPlaylistInfo(playlistId: string): Promise<PlaylistMeta> {
    const url = `https://music.163.com/api/v6/playlist/detail?id=${playlistId}&n=100000`;
    const data = await fetchJson<NeteasePlaylistResponse>(url);

    if (data.code !== 200 || !data.playlist) {
      throw new Error(
        `Failed to fetch playlist info for id=${playlistId}: API returned code ${data.code}`,
      );
    }

    const pl = data.playlist;
    return {
      id: String(pl.id),
      name: pl.name,
      description: pl.description ?? '',
      coverUrl: pl.coverImgUrl,
      trackCount: pl.trackCount,
      creatorName: pl.creator?.nickname ?? 'Unknown',
      platform: 'netease',
    };
  }

  // ---- Playlist songs ----------------------------------------------------

  async getPlaylistSongs(playlistId: string): Promise<SongInfo[]> {
    // The /api/v6/playlist/detail endpoint returns both trackIds and (for
    // small playlists) the full track objects.  For larger playlists the
    // `tracks` array may be empty, so we fall back to fetching song details
    // individually via the song/detail endpoint in batches.

    const url = `https://music.163.com/api/v6/playlist/detail?id=${playlistId}&n=100000`;
    const data = await fetchJson<NeteasePlaylistResponse>(url);

    if (data.code !== 200 || !data.playlist) {
      throw new Error(
        `Failed to fetch playlist songs for id=${playlistId}: API returned code ${data.code}`,
      );
    }

    const { tracks, trackIds } = data.playlist;

    // If the response already contains full track objects, use them directly.
    if (tracks && tracks.length > 0) {
      return tracks.map(normaliseTrack);
    }

    // Otherwise resolve track IDs via the song detail API in batches of 1000.
    const ids = trackIds.map((t) => t.id);
    const batchSize = 1000;
    const allSongs: SongInfo[] = [];

    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const songUrl = `https://music.163.com/api/song/detail/?ids=[${batch.map((id) => JSON.stringify(id)).join(',')}]`;
      const songData = await fetchJson<NeteaseSongResponse>(songUrl);

      if (songData.code === 200 && songData.songs) {
        allSongs.push(...songData.songs.map(normaliseTrack));
      }
    }

    return allSongs;
  }

  // ---- Song lyrics -------------------------------------------------------

  async getSongLyrics(songId: string): Promise<string> {
    const url = `https://music.163.com/api/song/lyric?id=${songId}&lv=1`;
    const data = await fetchJson<NeteaseLyricResponse>(url);

    if (data.code !== 200) {
      throw new Error(
        `Failed to fetch lyrics for song id=${songId}: API returned code ${data.code}`,
      );
    }

    // Prefer original lyrics; fall back to translated lyrics if absent.
    if (data.lrc?.lyric) {
      return data.lrc.lyric;
    }
    if (data.tlyric?.lyric) {
      return data.tlyric.lyric;
    }

    return '';
  }

  // ---- Search ------------------------------------------------------------

  async searchSongs(keyword: string, limit: number = 30): Promise<SongInfo[]> {
    const url = `https://music.163.com/api/search/get?s=${encodeURIComponent(keyword)}&type=1&offset=0&limit=${limit}`;
    const data = await fetchJson<NeteaseSearchResponse>(url);

    if (data.code !== 200 || !data.result?.songs) {
      throw new Error(
        `Failed to search songs for keyword="${keyword}": API returned code ${data.code}`,
      );
    }

    return data.result.songs.map((song) => ({
      platformSongId: String(song.id),
      title: song.name,
      artist: song.artists.map((a) => a.name).join(' / '),
      album: song.album.name,
      duration: Math.round(song.duration / 1000), // ms -> seconds
      coverUrl: song.album.picUrl ?? undefined,
    }));
  }
}

// ---------------------------------------------------------------------------
// NetEaseOpenAdapter (Official Open Platform API with fallback)
// ---------------------------------------------------------------------------

export class NetEaseOpenAdapter implements MusicPlatformAdapter {
  readonly platform: MusicPlatform = 'netease-open';

  private signer: NetEaseOpenSigner;
  private fallback: NetEaseAdapter;

  constructor() {
    const appId = import.meta.env.PUBLIC_NETEASE_APP_ID
      ?? import.meta.env.NETEASE_APP_ID
      ?? '';
    const appSecret = import.meta.env.PUBLIC_NETEASE_APP_SECRET
      ?? import.meta.env.NETEASE_APP_SECRET
      ?? '';
    const privateKeyPem = import.meta.env.PUBLIC_NETEASE_PRIVATE_KEY
      ?? import.meta.env.NETEASE_PRIVATE_KEY
      ?? '';

    if (!appId || !appSecret || !privateKeyPem) {
      console.warn(
        '[NetEaseOpenAdapter] Missing NETEASE_APP_ID, NETEASE_APP_SECRET, or NETEASE_PRIVATE_KEY. ' +
        'All requests will fall back to the non-official API.',
      );
    }

    this.signer = new NetEaseOpenSigner(appId, appSecret, privateKeyPem);
    this.fallback = new NetEaseAdapter();
  }

  // ---- Playlist info -----------------------------------------------------

  async getPlaylistInfo(playlistId: string): Promise<PlaylistMeta> {
    try {
      const response = await this.signer.signedPost(
        '/openapi/playlist/detail',
        { id: Number(playlistId) },
      ) as OpenApiPlaylistResponse;

      if (response.code === 200 && response.data?.playlist) {
        const pl = response.data.playlist;
        return {
          id: String(pl.id),
          name: pl.name,
          description: pl.description ?? '',
          coverUrl: pl.coverImgUrl,
          trackCount: pl.trackCount,
          creatorName: pl.creator?.nickname ?? 'Unknown',
          platform: 'netease-open',
        };
      }
    } catch (err) {
      console.warn(
        '[NetEaseOpenAdapter] Official API failed for getPlaylistInfo, falling back:',
        err instanceof Error ? err.message : err,
      );
    }

    // Fallback to non-official API
    return this.fallback.getPlaylistInfo(playlistId);
  }

  // ---- Playlist songs ----------------------------------------------------

  async getPlaylistSongs(playlistId: string): Promise<SongInfo[]> {
    try {
      const response = await this.signer.signedPost(
        '/openapi/playlist/detail',
        { id: Number(playlistId) },
      ) as OpenApiPlaylistResponse;

      if (response.code === 200 && response.data?.playlist?.tracks) {
        const tracks = response.data.playlist.tracks;
        if (tracks.length > 0) {
          return tracks.map(normaliseTrack);
        }
      }
    } catch (err) {
      console.warn(
        '[NetEaseOpenAdapter] Official API failed for getPlaylistSongs, falling back:',
        err instanceof Error ? err.message : err,
      );
    }

    // Fallback to non-official API
    return this.fallback.getPlaylistSongs(playlistId);
  }

  // ---- Song lyrics -------------------------------------------------------

  async getSongLyrics(songId: string): Promise<string> {
    try {
      const response = await this.signer.signedPost(
        '/openapi/song/lyric',
        { id: Number(songId) },
      ) as OpenApiLyricResponse;

      if (response.code === 200 && response.data) {
        if (response.data.lrc?.lyric) {
          return response.data.lrc.lyric;
        }
        if (response.data.tlyric?.lyric) {
          return response.data.tlyric.lyric;
        }
        return '';
      }
    } catch (err) {
      console.warn(
        '[NetEaseOpenAdapter] Official API failed for getSongLyrics, falling back:',
        err instanceof Error ? err.message : err,
      );
    }

    // Fallback to non-official API
    return this.fallback.getSongLyrics(songId);
  }

  // ---- Search ------------------------------------------------------------

  async searchSongs(keyword: string, limit: number = 30): Promise<SongInfo[]> {
    try {
      const response = await this.signer.signedPost(
        '/openapi/search/get',
        { s: keyword, type: 1, offset: 0, limit },
      ) as OpenApiSearchResponse;

      if (response.code === 200 && response.data?.result?.songs) {
        return response.data.result.songs.map(normaliseTrack);
      }
    } catch (err) {
      console.warn(
        '[NetEaseOpenAdapter] Official API failed for searchSongs, falling back:',
        err instanceof Error ? err.message : err,
      );
    }

    // Fallback to non-official API
    return this.fallback.searchSongs(keyword, limit);
  }
}
