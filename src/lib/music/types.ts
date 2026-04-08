export type MusicPlatform = 'netease' | 'netease-open' | 'qq' | 'spotify';

export interface PlaylistMeta {
  id: string;
  name: string;
  description: string;
  coverUrl: string;
  trackCount: number;
  creatorName: string;
  platform: MusicPlatform;
}

export interface SongInfo {
  platformSongId: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // seconds
  coverUrl?: string;
}

export interface MusicPlatformAdapter {
  platform: MusicPlatform;
  getPlaylistInfo(playlistId: string): Promise<PlaylistMeta>;
  getPlaylistSongs(playlistId: string): Promise<SongInfo[]>;
  getSongLyrics(songId: string): Promise<string>;
  searchSongs(keyword: string, limit?: number): Promise<SongInfo[]>;
}

export interface ParsedPlaylistUrl {
  platform: MusicPlatform;
  id: string;
}
