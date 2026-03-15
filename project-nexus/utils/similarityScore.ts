// ════════════════════════════════════════════════════════════════
// project-nexus/utils/similarityScore.ts
//
// Scores semantic similarity between an AI chatbot response
// and an expected question intent using OpenAI gpt-4o-mini.
//
// Lives at PROJECT level — the scoring prompt is a project decision.
// Uses callOpenAi — API key and model config in openAiConfig.ts.
// ════════════════════════════════════════════════════════════════

import { callOpenAi } from "./openAiClient";

/**
 * Scores how semantically similar an AI response is to an expected
 * question intent. Returns a float 0.0–1.0 and a human-readable reason.
 *
 * @param request          Playwright APIRequestContext
 * @param aiResponse       Full chatbot response string
 * @param expectedQuestion Natural language description of expected intent
 * @returns                { score: 0.0–1.0, reason: string }
 */
export async function similarityScore(
  request:          any,
  aiResponse:       string,
  expectedQuestion: string
): Promise<{ score: number; reason: string }> {

  const content = await callOpenAi(request, [{
    role:    "user",
    content:
`You are a semantic similarity evaluator for a conversational chatbot test suite.
Supports English and Arabic.

AI chatbot response:
"""
${aiResponse}
"""

Expected question intent:
"""
${expectedQuestion}
"""

Score how semantically similar the AI response is to the expected question intent on a scale of 0.0 to 1.0:
- 1.0 = identical meaning, just different wording
- 0.75 = clearly asking the same thing with minor differences
- 0.5 = partially related but missing key intent
- 0.25 = loosely related
- 0.0 = completely different

Reply ONLY with valid JSON, no markdown:
{ "score": 0.95, "reason": "brief explanation" }`,
  }]);

  try {
    return JSON.parse(content) as { score: number; reason: string };
  } catch {
    return { score: 0, reason: `Score parse failed: ${content}` };
  }
}
