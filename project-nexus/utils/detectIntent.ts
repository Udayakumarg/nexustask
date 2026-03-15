// ════════════════════════════════════════════════════════════════
// project-nexus/utils/detectIntent.ts
//
// Scores an AI response against all candidate intents in parallel
// and returns the best match above the given threshold.
//
// Accepts intentMap, intentAliases, and threshold as parameters.
// Uses similarityScore which calls callOpenAi internally.
// ════════════════════════════════════════════════════════════════

import { similarityScore } from "./similarityScore";

/**
 * Detects which intent the AI is currently expressing.
 *
 * @param request          Playwright APIRequestContext
 * @param aiResponse       Full chatbot response string
 * @param candidateIntents Remaining intent keys to score against
 * @param intentMap        Full map of intent key → judge question
 * @param intentAliases    Alias → canonical intent key map
 * @param threshold        Minimum score to consider a match (e.g. 0.75)
 * @returns                Best matching intent key, its score, and reason
 */
export async function detectIntent(
  request:          any,
  aiResponse:       string,
  candidateIntents: string[],
  intentMap:        Record<string, string>,
  intentAliases:    Record<string, string>,
  threshold:        number
): Promise<{ intent: string | null; score: number; reason: string }> {

  // Expand candidates to include alias intents that resolve back
  // to one of the remaining candidates
  const aliasIntents = Object.entries(intentAliases)
    .filter(([, canonical]) => candidateIntents.includes(canonical))
    .map(([alias]) => alias);

  const allIntentsToScore = [...new Set([...candidateIntents, ...aliasIntents])];

  // Score all in parallel for speed
  const results = await Promise.all(
    allIntentsToScore.map(async (intent) => {
      const question = intentMap[intent];
      if (!question) return { intent, score: 0, reason: "Unknown intent — not in intentMap" };
      const { score, reason } = await similarityScore(request, aiResponse, question);
      return { intent, score, reason };
    })
  );

  // Pick the highest scoring intent
  let bestIntent: string | null = null;
  let bestScore  = 0;
  let bestReason = "";

  for (const result of results) {
    if (result.score > bestScore) {
      bestScore  = result.score;
      bestIntent = result.intent;
      bestReason = result.reason;
    }
  }

  if (bestScore < threshold) {
    return { intent: null, score: bestScore, reason: bestReason };
  }

  return { intent: bestIntent, score: bestScore, reason: bestReason };
}
