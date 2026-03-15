import { test, expect }           from "simple-playwright-framework";
import { initApiAuthSession }      from "simple-playwright-framework";
import { apiProviderRegistry }     from "@project-nexus/auth";
import { pickAnswer }              from "../../../utils/openAiAnswerPicker";

test("Nexus chat scenario", async ({ request, envConfig, td }) => {

  // ══════════════════════════════════════════════════════════════
  // AUTH — get JWT token
  // ══════════════════════════════════════════════════════════════
  const token = await initApiAuthSession(
    request,
    envConfig.authStorage,
    { username: td.username, password: td.password },
    apiProviderRegistry
  );

  const MAX_TURNS = td.maxTurns;

  // ══════════════════════════════════════════════════════════════
  // sendMessage — one conversation turn
  // ══════════════════════════════════════════════════════════════
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

  // ══════════════════════════════════════════════════════════════
  // isConfirmation — AI shows full JSON block = form is complete
  // ══════════════════════════════════════════════════════════════
  function isConfirmation(content: string): boolean {
    return content.includes("```json");
  }

  // ══════════════════════════════════════════════════════════════
  // STEP 1 — Initial request
  // ══════════════════════════════════════════════════════════════
  let lastResponse = await sendMessage(td.initialRequest);
  console.log(`\n[INIT] Sent : "${td.initialRequest}"`);
  console.log(`[INIT] AI   : "${lastResponse.content.substring(0, 120)}"`);

  // ══════════════════════════════════════════════════════════════
  // STEP 2 — Conversation loop
  //
  // Each turn: OpenAI picks the best answer from inputJson.
  // If AI sends an informational message (no answer needed),
  // reply with "ok" and continue.
  // Loops until confirmation JSON block detected or MAX_TURNS hit.
  // ══════════════════════════════════════════════════════════════
  let turnCount = 0;

  while (!isConfirmation(lastResponse.content) && turnCount < MAX_TURNS) {
    turnCount++;
    console.log(`\n[LOOP ${turnCount}] AI : "${lastResponse.content.substring(0, 120)}"`);

    const answer = await pickAnswer(
      request,
      lastResponse.content,
      td.inputJson
    );

    if (!answer) {
      console.log(`[LOOP ${turnCount}] ℹ️ Informational — sending "ok"`);
      lastResponse = await sendMessage("ok");
      continue;
    }

    console.log(`[LOOP ${turnCount}] Sending : "${answer}"`);
    lastResponse = await sendMessage(answer);
  }

  expect(
    isConfirmation(lastResponse.content),
    `Expected confirmation JSON after ${turnCount} turns.
     AI said : "${lastResponse.content.substring(0, 200)}"`
  ).toBe(true);
  console.log(`\n[CONFIRM] ✅ Confirmation shown after ${turnCount} turns`);

  // ══════════════════════════════════════════════════════════════
  // STEP 3 — Edit flow or direct YES
  // confirmationResponse captures the JSON before submission
  // ══════════════════════════════════════════════════════════════
  let confirmationResponse = lastResponse;

  if (td.editJson) {
    lastResponse = await sendMessage("NO");
    console.log(`\n[EDIT] Sent : "NO" | AI : "${lastResponse.content.substring(0, 120)}"`);

    lastResponse = await sendMessage(td.editJson);
    console.log(`[EDIT] Sent : "${td.editJson}"`);
    console.log(`[EDIT] AI   : "${lastResponse.content.substring(0, 120)}"`);

    // Loop to handle informational warnings before revised confirmation
    let editTurns = 0;
    while (!isConfirmation(lastResponse.content) && editTurns < 5) {
      editTurns++;
      console.log(`[EDIT LOOP ${editTurns}] Not confirmed yet — sending "yes please proceed"`);
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

  // ══════════════════════════════════════════════════════════════
  // STEP 4 — Final JSON assertion
  // Parsed from confirmationResponse (before YES) not submission response
  // Falls back to inputJson if finalJson not present in test data
  // ══════════════════════════════════════════════════════════════
  const expectedJson = td.finalJson ?? td.inputJson;

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

  // ══════════════════════════════════════════════════════════════
  // STEP 5 — Reference ID assertion from submission response
  // ══════════════════════════════════════════════════════════════
  if (td.expectedReferenceIdPrefix) {
    const refId = lastResponse.content.match(/[A-Z]{2,3}-[A-Z0-9]{8}/)?.[0] ?? null;
    expect(refId,  "No reference ID in final response").not.toBeNull();
    expect(
      refId!.startsWith(td.expectedReferenceIdPrefix),
      `Expected ref ID starting with [${td.expectedReferenceIdPrefix}], got [${refId}]`
    ).toBe(true);
    console.log(`[REF ID] ✅ ${refId}`);
  }

});