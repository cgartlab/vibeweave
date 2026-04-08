import type { AIProvider, AIConfig, AIProviderType } from './types';
import { OpenAIProvider } from './openai-provider';
import { LocalProvider } from './local-provider';

export type { AIProvider, AIConfig, AIProviderType, SongAnalysisInput, SongAnalysisResult, CommandContext, CommandParseResult } from './types';

export function createAIProvider(config?: Partial<AIConfig>): AIProvider {
  const provider = (config?.provider || (import.meta.env.AI_PROVIDER as AIProviderType)) || 'openai';

  const fullConfig: AIConfig = {
    provider,
    model: config?.model || import.meta.env.OPENAI_MODEL || 'gpt-4o-mini',
    apiKey: config?.apiKey || import.meta.env.OPENAI_API_KEY || '',
    baseUrl: config?.baseUrl || import.meta.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    temperature: config?.temperature,
  };

  switch (provider) {
    case 'openai':
      return new OpenAIProvider(fullConfig);
    case 'nvidia':
      return new OpenAIProvider({
        ...fullConfig,
        provider: 'nvidia',
        baseUrl: config?.baseUrl || import.meta.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
        apiKey: config?.apiKey || import.meta.env.NVIDIA_API_KEY || import.meta.env.OPENAI_API_KEY || '',
        model: config?.model || import.meta.env.NVIDIA_MODEL || 'nvidia/llama-3.1-nemotron-70b-instruct',
      });
    case 'local':
      return new LocalProvider({
        ...fullConfig,
        baseUrl: config?.baseUrl || import.meta.env.LOCAL_MODEL_URL || 'http://localhost:11434',
        model: config?.model || import.meta.env.LOCAL_MODEL_NAME || 'llama3',
      });
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

export { buildSongAnalysisPrompt, buildCommandParsePrompt, EMOTION_LABEL_STANDARDIZATION } from './prompt-templates';
export { parseAnalysisResponse, parseCommandResponse, normalizeEmotionLabels } from './parser';
