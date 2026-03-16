// import { test, expect } from "simple-playwright-framework";
// import { similarityScore }  from "../../../utils/similarityScore";
// import { detectIntent }     from "../../../utils/detectIntent";
// import leaveSchema          from "../../../config/schemas/leave.schema.json";

// test("Nexus chat scenario", async ({ request, envConfig, td, pc }) => {

//   // ══════════════════════════════════════════════════════════════
//   // AUTH — get JWT token
//   // ══════════════════════════════════════════════════════════════
//   console.log(`Login URL : ${envConfig.apiUrl}`);
//   const loginRes  = await request.post(`${envConfig.apiUrl}/api/v1/auth/login`, {
//     data: { username: td.username, password: td.password },
//   });
//   const loginData = await loginRes.json();
//   expect(loginData.success, `Login failed: ${loginData.message}`).toBe(true);
//   const token = loginData.data.accessToken;
//   console.log(`[AUTH] ✅ Logged in as: ${td.username}`);

//   // ══════════════════════════════════════════════════════════════
//   // sendMessage — one conversation turn
//   // Tracks conversationId automatically across turns
//   // ══════════════════════════════════════════════════════════════
//   let conversationId: number | null = null;

//   async function sendMessage(message: string) {
//     const res = await request.post(`${envConfig.apiUrl}/api/v1/schema-chat/message`, {
//       headers: { Authorization: `Bearer ${token}` },
//       data: { message, conversationId: conversationId ?? undefined },
//     });
//     const data = await res.json();
//     expect(data.success, `Chat failed: ${data.message}`).toBe(true);
//     conversationId = data.data.conversationId;
//     return data.data;
//   }

//   // ══════════════════════════════════════════════════════════════
//   // STEP 1 — Initial request
//   // ══════════════════════════════════════════════════════════════
//   let lastResponse = await sendMessage(td.initialRequest);
//   console.log(`\n[INIT] Sent : "${td.initialRequest}"`);
//   console.log(`[INIT] AI   : "${lastResponse.content.substring(0, 120)}"`);

//   // ══════════════════════════════════════════════════════════════
//   // STEP 2 — Dynamic order-agnostic conversation loop
//   //
//   // Builds answerMap from td.conversation keyed by expectedIntent.
//   // Each iteration detects the current field being asked,
//   // resolves aliases, sends the right answer, removes matched intent.
//   // Order in td.conversation does not matter.
//   // ══════════════════════════════════════════════════════════════
//   if (td.conversation && td.conversation.length > 0) {

//     const answerMap = new Map<string, { userResponse: string; jsonKey: string }>(
//       td.conversation.map((turn: any) => [
//         turn.expectedIntent,
//         { userResponse: turn.userResponse, jsonKey: turn.jsonKey },
//       ])
//     );

//     const remainingIntents = [...answerMap.keys()];
//     const maxTurns         = td.conversation.length + 3;
//     let   turnCount        = 0;

//     while (remainingIntents.length > 0 && turnCount < maxTurns) {
//       turnCount++;
//       console.log(`\n[LOOP ${turnCount}] Remaining: ${remainingIntents.join(", ")}`);

//       const { intent, score, reason } = await detectIntent(
//         request,
//         envConfig.openAiApiKey,
//         lastResponse.content,
//         remainingIntents,
//         leaveSchema.intentMap,
//         leaveSchema.intentAliases,
//         pc.threshold
//       );

//       console.log(
//         `[LOOP ${turnCount}] Detected: "${intent ?? "NONE"}" | Score: ${score.toFixed(2)} | ${reason}`
//       );

//       // Resolve alias → canonical before answerMap lookup
//       const canonicalIntent = (intent && leaveSchema.intentAliases[intent as keyof typeof leaveSchema.intentAliases])
//         ? leaveSchema.intentAliases[intent as keyof typeof leaveSchema.intentAliases]
//         : intent;

//       expect(
//         intent,
//         `[LOOP ${turnCount}] No intent matched above threshold (${pc.threshold}).
//          AI said    : "${lastResponse.content.substring(0, 200)}"
//          Best score : ${score.toFixed(2)}
//          Reason     : ${reason}
//          Remaining  : ${remainingIntents.join(", ")}

//          Fix: Add entry to intentAliases or intentMap in leave.schema.json`
//       ).not.toBeNull();

//       const matched = answerMap.get(canonicalIntent!)!;
//       console.log(
//         `[LOOP ${turnCount}] ✅ [${matched.jsonKey}]${
//           intent !== canonicalIntent ? ` via alias "${intent}" → "${canonicalIntent}"` : ""
//         } (score: ${score.toFixed(2)}) — sending: "${matched.userResponse}"`
//       );

//       const idxToRemove = remainingIntents.indexOf(canonicalIntent!);
//       if (idxToRemove !== -1) remainingIntents.splice(idxToRemove, 1);

//       lastResponse = await sendMessage(matched.userResponse);
//       console.log(`[LOOP ${turnCount}] AI : "${lastResponse.content.substring(0, 120)}"`);
//     }

//     if (remainingIntents.length > 0) {
//       console.warn(`[LOOP] ⚠️ Unanswered intents: ${remainingIntents.join(", ")}`);
//     }
//   }

//   // ══════════════════════════════════════════════════════════════
//   // STEP 3 — Edit flow (only runs if td.edit is present)
//   // ══════════════════════════════════════════════════════════════
//   if (td.edit) {
//     console.log(`\n[EDIT] ${JSON.stringify(td.edit, null, 2)}`);

//     const preEditConfirm = await similarityScore(
//       request, envConfig.openAiApiKey, lastResponse.content,
//       leaveSchema.intentMap["confirm_submission"]
//     );
//     expect(
//       preEditConfirm.score >= pc.threshold,
//       `Edit: expected confirmation before NO.
//        AI said : "${lastResponse.content.substring(0, 120)}"
//        Score   : ${preEditConfirm.score.toFixed(2)}
//        Reason  : ${preEditConfirm.reason}`
//     ).toBe(true);

//     lastResponse = await sendMessage("NO");
//     console.log(`[EDIT] Sent : "NO" | AI : "${lastResponse.content.substring(0, 120)}"`);

//     const editPrompt = await similarityScore(
//       request, envConfig.openAiApiKey, lastResponse.content,
//       leaveSchema.intentMap["ask_what_to_change"]
//     );
//     expect(
//       editPrompt.score >= pc.threshold,
//       `Edit: expected AI to ask what to change.
//        AI said : "${lastResponse.content.substring(0, 120)}"
//        Score   : ${editPrompt.score.toFixed(2)}
//        Reason  : ${editPrompt.reason}`
//     ).toBe(true);
//     console.log(`[EDIT] ✅ AI asked what to change (score: ${editPrompt.score.toFixed(2)})`);

//     lastResponse = await sendMessage(td.edit.message);
//     console.log(`[EDIT] Sent : "${td.edit.message}" | AI : "${lastResponse.content.substring(0, 120)}"`);

//     const editConfirm = await similarityScore(
//       request, envConfig.openAiApiKey, lastResponse.content,
//       leaveSchema.intentMap["confirm_submission"]
//     );
//     expect(
//       editConfirm.score >= pc.threshold,
//       `Edit: expected revised confirmation.
//        AI said : "${lastResponse.content.substring(0, 120)}"
//        Score   : ${editConfirm.score.toFixed(2)}
//        Reason  : ${editConfirm.reason}`
//     ).toBe(true);
//     console.log(`[EDIT] ✅ Revised confirmation shown (score: ${editConfirm.score.toFixed(2)})`);

//     lastResponse = await sendMessage("YES");
//     console.log(`[EDIT] Sent : "YES"`);

//   } else {

//     // ── No edit — assert confirmation then YES ─────────────────
//     const confirmResult = await similarityScore(
//       request, envConfig.openAiApiKey, lastResponse.content,
//       leaveSchema.intentMap["confirm_submission"]
//     );
//     expect(
//       confirmResult.score >= pc.threshold,
//       `Expected confirmation before YES.
//        AI said : "${lastResponse.content.substring(0, 120)}"
//        Score   : ${confirmResult.score.toFixed(2)}
//        Reason  : ${confirmResult.reason}`
//     ).toBe(true);
//     console.log(`[CONFIRM] ✅ Confirmation shown (score: ${confirmResult.score.toFixed(2)})`);

//     lastResponse = await sendMessage("YES");
//     console.log(`[CONFIRM] Sent : "YES"`);
//   }

//   console.log(`\n[FINAL] AI : "${lastResponse.content.substring(0, 200)}"`);

//   // ══════════════════════════════════════════════════════════════
//   // STEP 4 — Final JSON assertion
//   // ══════════════════════════════════════════════════════════════
//   if (td.finalJson && Object.keys(td.finalJson).length > 0) {

//     const blockMatch = lastResponse.content.match(/```json\s*([\s\S]*?)```/);
//     const rawMatch   = lastResponse.content.match(/\{[\s\S]*\}/);
//     const match      = blockMatch || rawMatch;
//     const payload    = match ? JSON.parse((match[1] || match[0]).trim()) : null;

//     expect(
//       payload,
//       `No JSON in final response: "${lastResponse.content.substring(0, 200)}"`
//     ).not.toBeNull();

//     console.log(`\n[PAYLOAD] Actual  : ${JSON.stringify(payload,    null, 2)}`);
//     console.log(`[PAYLOAD] Expected: ${JSON.stringify(td.finalJson, null, 2)}`);

//     for (const [field, expected] of Object.entries(td.finalJson)) {
//       expect(
//         payload![field],
//         `Field [${field}]: expected "${expected}", got "${payload![field]}"`
//       ).toBe(expected);
//     }
//     console.log(`[PAYLOAD] ✅ All fields match`);
//   }

//   // ══════════════════════════════════════════════════════════════
//   // STEP 5 — Reference ID assertion
//   // ══════════════════════════════════════════════════════════════
//   if (td.expectedReferenceIdPrefix) {
//     const refId = lastResponse.content.match(/[A-Z]{2,3}-[A-Z0-9]{8}/)?.[0] ?? null;
//     expect(refId,  "No reference ID in final response").not.toBeNull();
//     expect(
//       refId!.startsWith(td.expectedReferenceIdPrefix),
//       `Expected ref ID starting with [${td.expectedReferenceIdPrefix}], got [${refId}]`
//     ).toBe(true);
//     console.log(`[REF ID] ✅ ${refId}`);
//   }

// });
