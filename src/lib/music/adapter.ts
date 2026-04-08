import type { MusicPlatformAdapter, ParsedPlaylistUrl, MusicPlatform } from './types';
import { NetEaseAdapter, NetEaseOpenAdapter } from './netease';

/**
 * Returns the appropriate platform adapter for the given music platform.
 *
 * @param platform - The music platform identifier.
 * @returns A fully-implemented MusicPlatformAdapter.
 * @throws Error if the platform is not yet supported.
 */
export function getPlatformAdapter(platform: MusicPlatform): MusicPlatformAdapter {
  switch (platform) {
    case 'netease':
      return new NetEaseAdapter();
    case 'netease-open':
      return new NetEaseOpenAdapter();
    case 'qq':
      throw new Error('QQ Music adapter not yet implemented');
    case 'spotify':
      throw new Error('Spotify adapter not yet implemented');
    default:
      throw new Error(`Unknown platform: ${platform}`);
  }
}

/**
 * Regex patterns used to extract playlist IDs from platform URLs.
 */
const URL_PATTERNS: Record<string, RegExp> = {
  netease: /^https?:\/\/music\.163\.com\/.*[?#]?id=(\d+)/,
  'netease-open': /^https?:\/\/music\.163\.com\/.*[?#]?id=(\d+)/,
  qq: /^https?:\/\/y\.qq\.com\/n\/ryqq\/playlist\/(\d+)/,
  spotify: /^https?:\/\/open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)/,
};

/**
 * Validates a playlist URL and extracts the platform and playlist ID.
 *
 * Supported URL formats:
 * - NetEase (non-official): https://music.163.com/#/playlist?id=123456
 * - NetEase (official):     https://music.163.com/#/playlist?id=123456
 * - QQ Music:               https://y.qq.com/n/ryqq/playlist/123456
 * - Spotify:                https://open.spotify.com/playlist/abc123def456
 *
 * @param url - The playlist URL to validate.
 * @returns A ParsedPlaylistUrl if the URL matches a known pattern, or null otherwise.
 */
export function validatePlaylistUrl(url: string): ParsedPlaylistUrl | null {
  for (const [platform, regex] of Object.entries(URL_PATTERNS)) {
    const match = url.match(regex);
    if (match) {
      return { platform: platform as MusicPlatform, id: match[1] };
    }
  }
  return null;
}
