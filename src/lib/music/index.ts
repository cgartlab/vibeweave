// Music module - public API
export type {
  MusicPlatform,
  PlaylistMeta,
  SongInfo,
  MusicPlatformAdapter,
  ParsedPlaylistUrl,
} from './types';

export { NetEaseAdapter, NetEaseOpenAdapter } from './netease';
export { NetEaseCrypto, NetEaseOpenSigner } from './crypto';
export { getPlatformAdapter, validatePlaylistUrl } from './adapter';
