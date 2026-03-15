
import { test, expect, scenarioLoader } from "simple-playwright-framework";

const scenarios = scenarioLoader(__filename);

test.describe.parallel("Nexus Chat scenarios", () => {
  for (const sc of scenarios) {

    const tags = (sc.tags ?? []).map((t: string) => `@${t}`).join(" ");

    test(`Scenario: ${sc.name} ${tags}`, async ({ envConfig, td }) => {

        console.log(`Running Scenario Name: ${sc.name}`);


      // ── STEP 2 — Conversation turns ────────────────────────────
      // Skip entirely if conversation array is empty
      if (sc.conversation && sc.conversation.length > 0) {

        for (let i = 0; i < sc.conversation.length; i++) {
          const turn = sc.conversation[i];

        console.log(`Conversation `+ i + `: ${sc.conversation[i]}`);

          // OpenAI judge — only if expectedIntent set on this turn
        }
      }

      // ── STEP 3 — Edit flow ─────────────────────────────────────
      // Only runs if edit object is present in scenario
      if (sc.edit) {

            console.log(`Edit is present in scenario:`);
        // Send NO to trigger edit mode
      }
    });
  }
});