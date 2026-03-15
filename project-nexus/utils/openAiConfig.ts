// ════════════════════════════════════════════════════════════════
// project-nexus/utils/openAiConfig.ts
//
// Single source of truth for OpenAI configuration.
// All OpenAI calls go through openAiClient.ts which reads from here.
//
// To change the key source (vault, secrets manager etc),
// update this file only — nothing else needs to change.
// ════════════════════════════════════════════════════════════════

/**
 * Returns the OpenAI API key from environment variables.
 * Throws a clear error if not set — prevents silent failures.
 */
export function getOpenAiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error(
    "[OpenAI] OPENAI_API_KEY is not set.\n" +
    "  Local: add it to project-nexus/.env\n" +
    "  CI/CD: add it as a pipeline secret"
  );
  return key;
}

// Default model and token settings — change here to affect all calls
export const OPENAI_DEFAULTS = {
  model:       "gpt-4o-mini",
  maxTokens:   150,
  temperature: 0,             // temperature=0 → deterministic results every run
} as const;
