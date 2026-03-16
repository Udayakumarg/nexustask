// ════════════════════════════════════════════════════════════════
// project-nexus/tests/api/chat/chat-leave.spec.ts
//
// Leave application — all scenarios across all data files.
//
// ADD NEW DATA FILES HERE — spec never changes for new scenarios.
// Each data file has EN + AR variants of one scenario type.
//
// Data files loaded from: data/api/chat/
// ════════════════════════════════════════════════════════════════

import { test, expect, scenarioLoader } from "simple-playwright-framework";
import { initApiAuthSession }           from "simple-playwright-framework";
import { getApiProviderRegistry }       from "@project-nexus/auth";
import { pickAnswer }                   from "../../../utils/openAiAnswerPicker";

// ── Data files to load ────────────────────────────────────────
// Add new files here as new scenario types are created.
// Each file = one scenario type with EN + AR variants.
const DATA_FILES = [
  "chat-leave",                                  // happy path EN + AR
  "chat-leave-voice",                            // voice/STT simulation EN + AR
  "chat-leave-negative-invalid-date",            // invalid date formats EN + AR
  "chat-leave-negative-invalid-manager",         // manager as pronoun EN + AR
  "chat-leave-negative-invalid-type",            // invalid leave type + R_ARABIC_JSON regression
  "chat-leave-boundary-bulk-input",              // all fields in first message EN + AR
  "chat-leave-boundary-max-length",              // max length + special characters EN + AR
  "chat-leave-boundary-arabic-diacritics",       // Arabic diacritics, numerals, emoji
  "chat-leave-gate-bypass",                      // R3 human-in-loop gate + prompt injection
];

// ── Outer loop — one describe block per data file ─────────────
for (const dataFile of DATA_FILES) {

  // Load scenarios for this data file
  // scenarioLoader resolves: data/api/chat/{dataFile}.json
  let scenarios: any[];
  try {
    scenarios = scenarioLoader(__filename, dataFile);
  } catch {
    // Skip if file doesn't exist yet — allows incremental addition
    console.warn(`[SKIP] Data file not found: ${dataFile}.json`);
    continue;
  }

  test.describe.parallel(dataFile, () => {
    for (const sc of scenarios) {

      const tags = (sc.tags ?? []).map((t: string) => `@${t}`).join(" ");

      test(`${sc.name} ${tags}`, async ({ request, envConfig }) => {

        // ══════════════════════════════════════════════════════
        // AUTH — get JWT token
        // ══════════════════════════════════════════════════════
        const token = await initApiAuthSession(
          request,
          envConfig.authStorage,
          { username: sc.username, password: sc.password },
          getApiProviderRegistry(envConfig.apiUrl!)
        );

        const MAX_TURNS = sc.maxTurns ?? 15;

        // ── sendMessage ───────────────────────────────────────
        let conversationId: number | null = null;

        async function sendMessage(message: string) {
          const res = await request.post(`${envConfig.apiUrl}/api/v1/schema-chat/message`, {
            headers: { Authorization: `Bearer ${token}` },
            data: { message, conversationId: conversationId ?? undefined },
          });
          const data = await res.json();
          expect(data.success, `Chat failed: ${data.message}`).toBe(true);
          conversationId = data.data.conversationId;
          return data.data;
        }

        // ── isConfirmation ────────────────────────────────────
        function isConfirmation(content: string): boolean {
          return content.includes("```json");
        }

        // ══════════════════════════════════════════════════════
        // STEP 1 — Initial request
        // ══════════════════════════════════════════════════════
        let lastResponse = await sendMessage(sc.initialRequest);
        console.log(`\n[INIT] Sent : "${sc.initialRequest}"`);
        console.log(`[INIT] AI   : "${lastResponse.content.substring(0, 120)}"`);

        // ══════════════════════════════════════════════════════
        // STEP 2 — Conversation loop
        //
        // OpenAI picks best answer from inputJson each turn.
        // Sends "ok" for informational messages.
        // Loops until confirmation or MAX_TURNS hit.
        //
        // For negative scenarios — loop exits at MAX_TURNS
        // without reaching confirmation. finalJson: {} skips
        // STEP 4 assertion automatically.
        // ══════════════════════════════════════════════════════
        let turnCount = 0;

        while (!isConfirmation(lastResponse.content) && turnCount < MAX_TURNS) {
          turnCount++;
          console.log(`\n[LOOP ${turnCount}] AI : "${lastResponse.content.substring(0, 120)}"`);

          const answer = await pickAnswer(
            request,
            lastResponse.content,
            sc.inputJson
          );

          if (!answer) {
            console.log(`[LOOP ${turnCount}] ℹ️ Informational — sending "ok"`);
            lastResponse = await sendMessage("ok");
            continue;
          }

          console.log(`[LOOP ${turnCount}] Sending : "${answer}"`);
          lastResponse = await sendMessage(answer);
        }

        // ── Confirmation check ────────────────────────────────
        // For negative scenarios (finalJson: {}) — skip this assertion.
        // For positive scenarios — confirmation must be shown.
        const hasExpectedJson = sc.finalJson && Object.keys(sc.finalJson).length > 0;

        if (hasExpectedJson) {
          expect(
            isConfirmation(lastResponse.content),
            `Expected confirmation JSON after ${turnCount} turns.
             AI said : "${lastResponse.content.substring(0, 200)}"`
          ).toBe(true);
          console.log(`\n[CONFIRM] ✅ Confirmation shown after ${turnCount} turns`);
        } else {
          console.log(`\n[CONFIRM] ℹ️ Negative scenario — skipping confirmation assertion after ${turnCount} turns`);
          console.log(`[CONFIRM] AI said : "${lastResponse.content.substring(0, 200)}"`);
          return; // ← exit early for negative scenarios — no submission needed
        }

        // ══════════════════════════════════════════════════════
        // STEP 3 — Edit flow or direct YES
        // ══════════════════════════════════════════════════════
        let confirmationResponse = lastResponse;

        if (sc.editJson) {
          lastResponse = await sendMessage("NO");
          console.log(`\n[EDIT] Sent : "NO" | AI : "${lastResponse.content.substring(0, 120)}"`);

          lastResponse = await sendMessage(sc.editJson);
          console.log(`[EDIT] Sent : "${sc.editJson}"`);
          console.log(`[EDIT] AI   : "${lastResponse.content.substring(0, 120)}"`);

          let editTurns = 0;
          while (!isConfirmation(lastResponse.content) && editTurns < 5) {
            editTurns++;
            console.log(`[EDIT LOOP ${editTurns}] Not confirmed — sending "yes please proceed"`);
            lastResponse = await sendMessage("yes please proceed");
            console.log(`[EDIT LOOP ${editTurns}] AI : "${lastResponse.content.substring(0, 120)}"`);
          }

          expect(
            isConfirmation(lastResponse.content),
            `Edit: expected revised confirmation.
             AI said : "${lastResponse.content.substring(0, 200)}"`
          ).toBe(true);
          console.log(`[EDIT] ✅ Revised confirmation shown`);

          confirmationResponse = lastResponse;
          lastResponse = await sendMessage("YES");
          console.log(`[EDIT] Sent : "YES"`);

        } else {
          lastResponse = await sendMessage("YES");
          console.log(`[CONFIRM] Sent : "YES"`);
        }

        console.log(`\n[FINAL] AI : "${lastResponse.content.substring(0, 200)}"`);

        // ══════════════════════════════════════════════════════
        // STEP 4 — Final JSON assertion
        // ══════════════════════════════════════════════════════
        const expectedJson = sc.finalJson ?? sc.inputJson;

        if (expectedJson && Object.keys(expectedJson).length > 0) {

          const blockMatch = confirmationResponse.content.match(/```json\s*([\s\S]*?)```/);
          const rawMatch   = confirmationResponse.content.match(/\{[\s\S]*\}/);
          const match      = blockMatch || rawMatch;
          const payload    = match ? JSON.parse((match[1] || match[0]).trim()) : null;

          expect(
            payload,
            `No JSON in confirmation response: "${confirmationResponse.content.substring(0, 200)}"`
          ).not.toBeNull();

          console.log(`\n[PAYLOAD] Actual  : ${JSON.stringify(payload,    null, 2)}`);
          console.log(`[PAYLOAD] Expected: ${JSON.stringify(expectedJson, null, 2)}`);

          for (const [field, expected] of Object.entries(expectedJson)) {
            expect(
              payload![field],
              `Field [${field}]: expected "${expected}", got "${payload![field]}"`
            ).toBe(expected);
          }
          console.log(`[PAYLOAD] ✅ All fields match`);
        }

        // ══════════════════════════════════════════════════════
        // STEP 5 — Reference ID assertion
        // ══════════════════════════════════════════════════════
        if (sc.expectedReferenceIdPrefix) {
          const refId = lastResponse.content.match(/[A-Z]{2,3}-[A-Z0-9]{8}/)?.[0] ?? null;
          expect(refId, "No reference ID in final response").not.toBeNull();
          expect(
            refId!.startsWith(sc.expectedReferenceIdPrefix),
            `Expected ref ID starting with [${sc.expectedReferenceIdPrefix}], got [${refId}]`
          ).toBe(true);
          console.log(`[REF ID] ✅ ${refId}`);
        }

      });
    }
  });
}
