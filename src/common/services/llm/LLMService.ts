import { BaseService, ServiceError } from '../base/BaseService';
import promptTemplate from './summarize.prompt.txt?raw';

export type LLMModel = 'kimi-k2' | 'qwen' | 'llama-3';

export interface LLMServiceOptions {
  apiKey?: string; // Now optional, can be read from env
  siteUrl?: string;
  siteName?: string;
  promptFilePath?: string;
  defaultModel?: LLMModel; // Optional default model
}

const MODEL_MAP: Record<LLMModel, string> = {
  'kimi-k2': 'moonshotai/kimi-k2:free',
  'qwen': 'qwen/qwen3-235b-a22b:free',
  'llama-3': 'meta-llama/llama-3.3-70b-instruct:free',
};

const MODEL_PRIORITY: LLMModel[] = ['qwen', 'llama-3', 'kimi-k2'];

function stripHtml(html: string): string {
  // Remove HTML tags and decode basic entities
  const tmp = html.replace(/<[^>]+>/g, ' ');
  // Optionally, decode HTML entities here if needed
  return tmp.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

export class LLMService extends BaseService {
  private apiKey: string;
  private siteUrl?: string;
  private siteName?: string;
  private defaultModel: LLMModel;

  constructor(options: LLMServiceOptions = {}) {
    super();
    this.apiKey = options.apiKey || import.meta.env.VITE_OPENROUTER_API_KEY || '';
    this.siteUrl = options.siteUrl;
    this.siteName = options.siteName;
    this.defaultModel = options.defaultModel || (import.meta.env.VITE_LLM_DEFAULT_MODEL as LLMModel) || 'kimi-k2';
    if (!this.apiKey) {
      throw new ServiceError('OpenRouter API key is required', 'NO_API_KEY');
    }
  }

  async getPrompt(): Promise<string> {
    return promptTemplate;
  }

  async summarize(text: string, model?: LLMModel): Promise<string> {
    const prompt = await this.getPrompt();
    // Remove HTML only, do not truncate
    const safeContent = stripHtml(text);
    const userContent = prompt.replace('{{CONTENT}}', safeContent);
    const modelsToTry: LLMModel[] = model ? [model, ...MODEL_PRIORITY.filter(m => m !== model)] : [...MODEL_PRIORITY];
    let lastError: Error | null = null;
    for (const tryModel of modelsToTry) {
      console.log(`[LLMService] Trying model: ${tryModel}`);
      const body = {
        model: MODEL_MAP[tryModel],
        messages: [
          { role: 'user', content: userContent },
        ],
      };
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      };
      if (this.siteUrl) headers['HTTP-Referer'] = this.siteUrl;
      if (this.siteName) headers['X-Title'] = this.siteName;
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          let errorBody = '';
          try {
            errorBody = await response.text();
          } catch { /* ignore error reading error body */ }
          console.error('OpenRouter API error:', response.status, errorBody);
          // If 429 or 503, try next model
          if (response.status === 429 || response.status === 503) {
            lastError = new ServiceError(
              `LLM API rate-limited or unavailable for model ${tryModel}: ${errorBody}`,
              response.status === 429 ? 'LLM_API_RATE_LIMIT' : 'LLM_API_UNAVAILABLE',
              response.status
            );
            if (lastError instanceof ServiceError) {
              console.warn(`[LLMService] Model ${tryModel} failed with ${lastError.code}, trying next model...`);
            } else {
              console.warn(`[LLMService] Model ${tryModel} failed, trying next model...`);
            }
            continue;
          }
          throw new ServiceError(`LLM API error: ${response.statusText} - ${errorBody}`, 'LLM_API_ERROR', response.status);
        }
        const data = await response.json();
        console.log(`[LLMService] Success with model: ${tryModel}`);
        return data.choices?.[0]?.message?.content || '';
      } catch (err) {
        // Only continue to next model on 429 or 503, otherwise throw
        if (
          err instanceof ServiceError &&
          (err.code === 'LLM_API_RATE_LIMIT' || err.code === 'LLM_API_UNAVAILABLE')
        ) {
          console.warn(`[LLMService] Model ${tryModel} failed with ${err.code}, trying next model...`);
          continue;
        }
        throw err;
      }
    }
    // If all models fail due to rate limit, throw last error
    if (lastError) throw lastError;
    throw new ServiceError('Failed to summarize with any LLM model', 'LLM_SUMMARY_ERROR');
  }
} 