// ════════════════════════════════════════════════════════════════
// project-nexus/utils/openAiClient.ts
//
// Single HTTP wrapper for all OpenAI chat completion calls.
// Reads API key and defaults from openAiConfig.ts.
//
// All OpenAI utilities (similarityScore, openAiAnswerPicker etc)
// call this instead of making raw HTTP calls themselves.
// ════════════════════════════════════════════════════════════════

import { getOpenAiKey, OPENAI_DEFAULTS } from "./openAiConfig";

/**
 * Sends a chat completion request to OpenAI and returns the
 * response text content.
 *
 * @param request   Playwright APIRequestContext
 * @param messages  Array of { role, content } messages
 * @param options   Optional overrides for model, maxTokens, temperature
 * @returns         Response text from OpenAI
 * @throws          If response is empty or API call fails
 */
export async function callOpenAi(
  request:  any,
  messages: { role: string; content: string }[],
  options?: {
    model?:       string;
    maxTokens?:   number;
    temperature?: number;
  }
): Promise<string> {

  const res = await request.post("https://api.openai.com/v1/chat/completions", {
    headers: { Authorization: `Bearer ${getOpenAiKey()}` },
    data: {
      model:       options?.model       ?? OPENAI_DEFAULTS.model,
      max_tokens:  options?.maxTokens   ?? OPENAI_DEFAULTS.maxTokens,
      temperature: options?.temperature ?? OPENAI_DEFAULTS.temperature,
      messages,
    },
  });

  const data    = await res.json() as any;
  const content = data.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error(
      `[OpenAI] Empty response received.\n` +
      `  Status : ${res.status()}\n` +
      `  Body   : ${JSON.stringify(data).substring(0, 200)}`
    );
  }

  return content;
}
