// ════════════════════════════════════════════════════════════════
// project-nexus/tests/ui/chat/chat-leave-ui.spec.ts
//
// Leave application — UI tests across all data files.
//
// ADD NEW DATA FILES HERE — spec never changes for new scenarios.
// Each data file has EN + AR variants.
//
// Key difference from API spec:
//   - Uses ChatPage POM — no raw selectors
//   - initAuthSession BEFORE page.goto — fixes blank screen
//   - No parallel — UI tests run sequentially
//
// Data files loaded from: data/ui/chat/
// ════════════════════════════════════════════════════════════════

import { test, expect, scenarioLoader } from "simple-playwright-framework";
import { initAuthSession }              from "simple-playwright-framework";
import { providerRegistry }             from "@project-nexus/auth";
import { ChatPage }                     from "../../../pages/ChatPage";
import { pickAnswer }                   from "../../../utils/openAiAnswerPicker";

// ── Data files to load ────────────────────────────────────────
const DATA_FILES = [
  "chat-leave",        // happy path EN + AR
  "chat-leave-edit",   // edit flow EN + AR
  "chat-leave-arabic", // full Arabic flow
];

for (const dataFile of DATA_FILES) {

  let scenarios: any[];
  try {
    scenarios = scenarioLoader(__filename, dataFile);
  } catch {
    console.warn(`[SKIP] Data file not found: ${dataFile}.json`);
    continue;
  }

  test.describe(dataFile, () => {
    for (const sc of scenarios) {

      const tags = (sc.tags ?? []).map((t: string) => `@${t}`).join(" ");

      test(`${sc.name} ${tags}`, async ({ page, request, envConfig }) => {

        // ══════════════════════════════════════════════════════
        // STEP 1 — Register auth FIRST, then navigate
        // ══════════════════════════════════════════════════════
        await initAuthSession(page, envConfig.authStorage, {
          username: sc.users.admin.username,
          password: sc.users.admin.password,
        }, providerRegistry);

        await page.goto(envConfig.baseUrl);

        const chat = new ChatPage(page);
        await chat.assertLoaded();
        console.log(`[AUTH] ✅ Session ready`);

        // ══════════════════════════════════════════════════════
        // STEP 2 — Send initial request
        // ══════════════════════════════════════════════════════
        await chat.sendMessage(sc.initialRequest);
        await chat.waitForResponse();

        let lastMessage = await chat.getLastAssistantMessage();
        console.log(`\n[INIT] Sent : "${sc.initialRequest}"`);
        console.log(`[INIT] AI   : "${lastMessage.substring(0, 120)}"`);

        // ══════════════════════════════════════════════════════
        // STEP 3 — Conversation loop
        // ══════════════════════════════════════════════════════
        const MAX_TURNS = sc.maxTurns ?? 15;
        let turnCount   = 0;

        while (!(await chat.isConfirmationVisible()) && turnCount < MAX_TURNS) {
          turnCount++;
          console.log(`\n[LOOP ${turnCount}] AI : "${lastMessage.substring(0, 120)}"`);

          const answer = await pickAnswer(
            request,
            lastMessage,
            sc.inputJson
          );

          if (!answer) {
            console.log(`[LOOP ${turnCount}] ℹ️ Informational — sending "ok"`);
            await chat.sendMessage("ok");
            await chat.waitForResponse();
            lastMessage = await chat.getLastAssistantMessage();
            continue;
          }

          console.log(`[LOOP ${turnCount}] Sending : "${answer}"`);
          await chat.sendMessage(answer);
          await chat.waitForResponse();
          lastMessage = await chat.getLastAssistantMessage();
        }

        // ── Confirmation check ────────────────────────────────
        const hasExpectedJson = sc.finalJson && Object.keys(sc.finalJson).length > 0;

        if (hasExpectedJson) {
          expect(
            await chat.isConfirmationVisible(),
            `Expected confirmation after ${turnCount} turns. AI said: "${lastMessage.substring(0, 200)}"`
          ).toBe(true);
          console.log(`\n[CONFIRM] ✅ Confirmation shown after ${turnCount} turns`);
        } else {
          console.log(`\n[CONFIRM] ℹ️ Negative — skipping after ${turnCount} turns`);
          console.log(`[CONFIRM] AI said : "${lastMessage.substring(0, 200)}"`);
          return;
        }

        // ══════════════════════════════════════════════════════
        // STEP 4 — Edit flow or direct YES
        // ══════════════════════════════════════════════════════
        if (sc.editJson) {
          await chat.clickConfirmNo();
          await chat.waitForResponse();
          console.log(`[EDIT] Sent : "NO"`);

          await chat.sendMessage(sc.editJson);
          await chat.waitForResponse();
          lastMessage = await chat.getLastAssistantMessage();
          console.log(`[EDIT] Sent : "${sc.editJson}"`);
          console.log(`[EDIT] AI   : "${lastMessage.substring(0, 120)}"`);

          let editTurns = 0;
          while (!(await chat.isConfirmationVisible()) && editTurns < 5) {
            editTurns++;
            console.log(`[EDIT LOOP ${editTurns}] Not confirmed — sending "yes please proceed"`);
            await chat.sendMessage("yes please proceed");
            await chat.waitForResponse();
            lastMessage = await chat.getLastAssistantMessage();
          }

          expect(
            await chat.isConfirmationVisible(),
            `Edit: expected revised confirmation. AI said: "${lastMessage.substring(0, 200)}"`
          ).toBe(true);
          console.log(`[EDIT] ✅ Revised confirmation shown`);

          await chat.clickConfirmYes();
          await chat.waitForResponse();
          console.log(`[EDIT] Sent : "YES"`);

        } else {
          await chat.clickConfirmYes();
          await chat.waitForResponse();
          console.log(`[CONFIRM] Sent : "YES"`);
        }

        // ══════════════════════════════════════════════════════
        // STEP 5 — Reference ID visible on screen
        // ══════════════════════════════════════════════════════
        lastMessage = await chat.getLastAssistantMessage();
        console.log(`\n[FINAL FULL] : "${lastMessage}"`);

        if (sc.expectedReferenceIdPrefix) {
          const refId = lastMessage.match(/[A-Z]{2,3}-[A-Z0-9]{8}/)?.[0] ?? null;
          expect(refId, "No reference ID visible on screen").not.toBeNull();
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
