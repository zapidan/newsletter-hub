import fs from 'fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LLMService } from '../../llm/LLMService';

let fetchSpy: any;

vi.mock('fs/promises');

describe('LLMService', () => {
  const apiKey = 'test-api-key';
  const promptFilePath = '/fake/path/summarize.prompt.txt';
  const promptTemplate = 'Summarize: {{CONTENT}}';
  const testText = 'This is a newsletter.';

  beforeEach(() => {
    vi.clearAllMocks();
    (fs.readFile as any).mockResolvedValue(promptTemplate);
    fetchSpy = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('loads the prompt and replaces content', async () => {
    const service = new LLMService({ apiKey, promptFilePath });
    const prompt = await service.getPrompt();
    expect(prompt).toBe(promptTemplate);
  });

  it('calls fetch with correct body for kimi-k2', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'summary' } }] }),
    });
    const service = new LLMService({ apiKey, promptFilePath });
    const summary = await service.summarize(testText, 'kimi-k2');
    expect(summary).toBe('summary');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: `Bearer ${apiKey}` }),
        body: expect.stringContaining('kimi-k2'),
      })
    );
  });

  it('throws on prompt load error', async () => {
    (fs.readFile as any).mockRejectedValue(new Error('fail'));
    const service = new LLMService({ apiKey, promptFilePath });
    await expect(service.getPrompt()).rejects.toThrow('Failed to load LLM prompt');
  });

  it('throws on fetch error', async () => {
    (fs.readFile as any).mockResolvedValue(promptTemplate);
    fetchSpy.mockRejectedValue(new Error('fail'));
    const service = new LLMService({ apiKey, promptFilePath });
    await expect(service.summarize(testText, 'kimi-k2')).rejects.toThrow('Failed to summarize with LLM');
  });
}); 