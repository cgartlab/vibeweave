export interface SongAnalysisInput {
  title: string;
  artist: string;
  album: string;
  lyrics?: string;
}

export interface SongAnalysisResult {
  valence: number;       // -1.00 ~ 1.00
  arousal: number;       // -1.00 ~ 1.00
  emotion_confidence: Record<string, number>;
  vibe_tags: Record<string, number>;
  reasoning: string;
}

export interface CommandContext {
  songs: Array<{
    id: string;
    title: string;
    artist: string;
    valence?: number;
    arousal?: number;
    topEmotion?: string;
  }>;
}

export interface CommandParseResult {
  sorted_ids: string[];
  filtered_ids?: string[];
  note: string;
}

export interface AIProvider {
  analyzeSong(input: SongAnalysisInput): Promise<SongAnalysisResult>;
  parseCommand(command: string, context: CommandContext): Promise<CommandParseResult>;
}

export type AIProviderType = 'openai' | 'nvidia' | 'local';

export interface AIConfig {
  provider: AIProviderType;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
}
