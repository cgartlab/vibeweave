export interface Song {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: string;
  emotion?: string;
  coverUrl?: string;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverUrl?: string;
  songCount: number;
  createdAt: Date;
  emotion?: string;
}

export interface EmotionData {
  emotion: string;
  value: number;
}
