import type { AIProvider, AIConfig, SongAnalysisInput, SongAnalysisResult, CommandContext, CommandParseResult } from './types';
import { buildSongAnalysisPrompt, buildCommandParsePrompt } from './prompt-templates';
import { parseAnalysisResponse, parseCommandResponse } from './parser';

export class OpenAIProvider implements AIProvider {
  private config: AIConfig;

  constructor(config: AIConfig) {
    this.config = config;
  }

  private get providerLabel(): string {
    return this.config.provider === 'nvidia' ? 'NVIDIA' : 'OpenAI';
  }

  private isNvidia(): boolean {
    return this.config.provider === 'nvidia';
  }

  private async callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
    const url = `${this.config.baseUrl || 'https://api.openai.com/v1'}/chat/completions`;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const body: Record<string, unknown> = {
          model: this.config.model || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: this.config.temperature ?? 0.2,
        };

        // NVIDIA API may not support response_format: { type: 'json_object' } for all models.
        // Use it for OpenAI, but for NVIDIA, rely on the system prompt instruction instead.
        if (!this.isNvidia()) {
          body.response_format = { type: 'json_object' };
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`${this.providerLabel} API error (${response.status}): ${error}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || '';
      } catch (error) {
        if (attempt === 2) throw error;
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(r => setTimeout(r, delay));
      }
    }
    throw new Error(`${this.providerLabel} API: Max retries exceeded`);
  }

  async analyzeSong(input: SongAnalysisInput): Promise<SongAnalysisResult> {
    const jsonInstruction = this.isNvidia()
      ? '仅输出纯净JSON，不要输出任何其他内容。Output JSON only.'
      : '仅输出纯净JSON。';
    const systemPrompt = `你是音乐情绪分析师，擅长从歌词和元数据中解读情感。${jsonInstruction}`;
    const userPrompt = buildSongAnalysisPrompt(input);
    const raw = await this.callLLM(systemPrompt, userPrompt);
    return parseAnalysisResponse(raw);
  }

  async parseCommand(command: string, context: CommandContext): Promise<CommandParseResult> {
    const jsonInstruction = this.isNvidia()
      ? '仅输出纯净JSON，不要输出任何其他内容。Output JSON only.'
      : '仅输出纯净JSON。';
    const systemPrompt = `你是歌单情绪编织助手。根据用户指令调整歌曲顺序或筛选。${jsonInstruction}`;
    const userPrompt = buildCommandParsePrompt(command, context);
    const raw = await this.callLLM(systemPrompt, userPrompt);
    return parseCommandResponse(raw);
  }
}
