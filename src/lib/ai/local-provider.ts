import type { AIProvider, AIConfig, SongAnalysisInput, SongAnalysisResult, CommandContext, CommandParseResult } from './types';
import { buildSongAnalysisPrompt, buildCommandParsePrompt } from './prompt-templates';
import { parseAnalysisResponse, parseCommandResponse } from './parser';

export class LocalProvider implements AIProvider {
  private config: AIConfig;
  private baseUrl: string;

  constructor(config: AIConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
  }

  private async callLLM(prompt: string): Promise<string> {
    const url = `${this.baseUrl}/api/generate`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.model || 'llama3',
          prompt,
          stream: false,
          format: 'json',
          options: {
            temperature: this.config.temperature ?? 0.2,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Local model error (${response.status}): ${await response.text()}`);
      }

      const data = await response.json();
      return data.response || '';
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('无法连接本地模型服务。请确保 Ollama 正在运行 (http://localhost:11434)');
      }
      throw error;
    }
  }

  async analyzeSong(input: SongAnalysisInput): Promise<SongAnalysisResult> {
    const prompt = buildSongAnalysisPrompt(input);
    const raw = await this.callLLM(prompt);
    return parseAnalysisResponse(raw);
  }

  async parseCommand(command: string, context: CommandContext): Promise<CommandParseResult> {
    const prompt = buildCommandParsePrompt(command, context);
    const raw = await this.callLLM(prompt);
    return parseCommandResponse(raw);
  }
}
