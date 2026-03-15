// ════════════════════════════════════════════════════════════════
// project-nexus/utils/openAiAnswerPicker.ts
//
// Given the AI's current question and a map of field→answer,
// asks OpenAI to pick the most appropriate answer to send.
//
// No intent map, no schema, no aliases — OpenAI figures it out.
// Uses callOpenAi — API key and model config in openAiConfig.ts.
// ════════════════════════════════════════════════════════════════

import { callOpenAi } from "./openAiClient";

/**
 * Picks the best answer from the inputJson map for the current AI question.
 *
 * @param request     Playwright APIRequestContext
 * @param aiQuestion  The AI's current response/question
 * @param inputJson   Full map of field → answer from test data
 * @returns           The answer string to send, or null if none matched
 */
export async function pickAnswer(
  request:    any,
  aiQuestion: string,
  inputJson:  Record<string, string>
): Promise<string | null> {

  const answersText = Object.entries(inputJson)
    .map(([field, value]) => `${field}: ${value}`)
    .join("\n");

  const content = await callOpenAi(request, [{
    role:    "user",
    content:
`You are helping fill out a conversational form.
The chatbot just said:
"""
${aiQuestion}
"""

Available answers:
${answersText}

Instructions:
- Read what the chatbot is asking for
- Pick the single most relevant value from the list above
- Reply with ONLY the answer value — no explanation, no field name, just the value
- If the chatbot is asking for a type/kind/category, look for the matching field
- If genuinely nothing matches, reply with: NO_MATCH`,
  }], { maxTokens: 100 });

  if (!content || content === "NO_MATCH") return null;
  return content;
}
