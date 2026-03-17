# NEXUS AI — Automated Test Suite (D2)

> QA Lead Design Challenge — Abu Dhabi Government  
> Framework: `simple-playwright-framework` (candidate's own npm package)  
> Live system: https://nexus-ai-wn4h.onrender.com

---

## Quick Start — 3 Commands

```bash
npm install --save-dev @playwright/test playwright
npm install simple-playwright-framework@latest
npx init-nexus
```

This creates a fully configured `project-nexus/` folder with all tests, data files, utilities, and config ready to run.

Then:

```bash
cd project-nexus
```

Run the tests:

```bash
npx playwright test tests/api --project=api --workers=1
```

> `--workers=1` is required — the backend runs on a free-tier server that cannot handle parallel requests.

---

## What This Is

This is the D2 automated test suite for the NEXUS AI conversational task assignment platform. It tests an AI-powered chatbot that collects structured form data through natural language conversation in English and Arabic.

The suite demonstrates that **traditional selector-based UI testing does not work for conversational AI**. Instead, every test drives the system via its REST API — using a second AI (GPT-4o-mini) as a semantic judge to pick the correct answers from test data — replacing brittle intent mapping with intelligent response handling.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                 Test Spec (.spec.ts)                │
│         scenarioLoader → reads JSON data file       │
└──────────────────┬──────────────────────────────────┘
                   │
         ┌─────────▼─────────┐
         │  sendMessage()    │  POST /api/v1/schema-chat/message
         │  JWT auth header  │  conversationId maintained
         └─────────┬─────────┘
                   │ AI response
         ┌─────────▼─────────┐
         │   pickAnswer()    │  GPT-4o-mini reads AI question
         │   OpenAI judge    │  picks answer from inputJson
         └─────────┬─────────┘
                   │ best answer
         ┌─────────▼─────────┐
         │  sendMessage()    │  sends answer back to chatbot
         └─────────┬─────────┘
                   │ loop until ```json confirmation block
         ┌─────────▼─────────┐
         │  Assert JSON      │  field-by-field validation
         │  Assert Ref ID    │  LVE-XXXXXXXX pattern match
         └───────────────────┘
```

**Key design decisions:**
- API-driven, not UI-scraping — resilient to UI changes
- One spec file per schema — never changes
- One JSON data file per scenario type — new scenarios = new JSON file
- OpenAI judge eliminates brittle intent mapping
- `finalJson: {}` = negative scenario, exits early without submission
- Auth token cached in `storage/` — login runs once, reused across tests

---

## How to Run

### API tests (all 44 scenarios)

```bash
npx playwright test tests/api --project=api --workers=1
```

### UI tests (6 scenarios, requires browser)

```bash
npx playwright test tests/ui --project=ui --workers=1 --headed
```

### Run everything

```bash
npx playwright test --workers=1
```

### Filter by tag

```bash
# Smoke tests only
SCENARIO_TAG=smoke npx playwright test tests/api --project=api --workers=1

# Negative tests only
SCENARIO_TAG=negative npx playwright test tests/api --project=api --workers=1

# Arabic tests only
SCENARIO_TAG=arabic npx playwright test tests/api --project=api --workers=1

# Gate bypass and security tests
SCENARIO_TAG=gate npx playwright test tests/api --project=api --workers=1
```

### Run with retries (CI recommended)

```bash
npx playwright test tests/api --project=api --workers=1 --retries=1
```

### View HTML report

```bash
npx playwright show-report
```

---

## Project Structure

```
project-nexus/
│
├── config/
│   ├── environments.json     ← baseUrl, apiUrl, auth config per env
│   └── projectConfig.json    ← threshold config
│
├── data/
│   ├── api/chat/             ← API test data (one file per scenario type)
│   │   ├── chat-leave.json                      happy path EN + AR
│   │   ├── chat-leave-voice.json                STT/voice simulation
│   │   ├── chat-leave-negative-invalid-date.json
│   │   ├── chat-leave-negative-invalid-manager.json
│   │   ├── chat-leave-negative-invalid-type.json
│   │   ├── chat-leave-boundary-bulk-input.json
│   │   ├── chat-leave-boundary-max-length.json
│   │   ├── chat-leave-boundary-arabic-diacritics.json
│   │   └── chat-leave-gate-bypass.json          R3 gate + prompt injection
│   │
│   └── ui/chat/              ← UI test data
│       ├── chat-leave.json
│       ├── chat-leave-edit.json
│       └── chat-leave-arabic.json
│
├── tests/
│   ├── api/chat/
│   │   └── chat-leave-api.spec.ts   ← single spec, all API scenarios
│   └── ui/chat/
│       └── chat-leave-ui.spec.ts    ← single spec, all UI scenarios
│
├── pages/
│   └── ChatPage.ts           ← Page Object Model for UI tests
│
├── utils/
│   ├── openAiConfig.ts       ← API key + model defaults (single source)
│   ├── openAiClient.ts       ← HTTP wrapper for all OpenAI calls
│   ├── openAiAnswerPicker.ts ← semantic answer selection judge
│   ├── similarityScore.ts    ← semantic similarity scoring
│   └── detectIntent.ts       ← intent detection
│
├── auth/
│   ├── index.ts              ← provider registries
│   ├── nexus.login.ts        ← UI auth (fills login form)
│   └── nexus.api.login.ts    ← API auth (JWT via POST)
│
├── storage/                  ← auto-created, gitignored
│   └── NexusLogin-prod-demo-auth.json   ← cached JWT token
│
├── .env                      ← NOT committed — OPENAI_API_KEY
├── .gitignore
├── playwright.config.ts
├── package.json
└── tsconfig.json
```

---

## Test Suite Summary

### API Tests — 44 Scenarios

| Category | Scenarios | What It Tests |
|---|---|---|
| Happy path | 2 | EN edit flow with date change, AR full happy path |
| Voice / STT | 6 | Mild errors, severe errors, no punctuation, Arabic voice, code-switching, date misrecognition |
| Negative — invalid date | 7 | DD/MM/YYYY, MM-DD-YYYY, past date, insufficient notice, end before start, AR date, AR notice |
| Negative — invalid manager | 5 | "my manager", "him", "my boss" EN; "مديري", "هو" AR |
| Negative — invalid type | 5 | Maternity, paternity, random string, AR invalid, R_ARABIC_JSON regression |
| Boundary — bulk input | 4 | All 7 fields upfront EN, partial EN, all AR, mixed AR/EN |
| Boundary — max length | 4 | 250+ char reason EN, special chars EN, long AR, special chars AR |
| Boundary — Arabic | 5 | Full diacritics, Eastern numerals, Tatweel, Arabic month names, emoji |
| Gate bypass | 6 | Immediate YES x2, incomplete fields, ambiguous, prompt injection EN, prompt injection AR |

### UI Tests — 6 Scenarios

| Scenario | Coverage |
|---|---|
| Happy path EN | Message renders, schema indicator appears, reference ID visible |
| Happy path AR | Arabic RTL rendering, Arabic confirm buttons |
| Edit flow EN | NO → modify dates → YES → reference ID |
| Edit flow AR | Arabic edit message, revised confirmation in Arabic |
| RTL direction switch | Input direction flips on Arabic typing |
| Arabic suggestion chip | Chip sends correct Arabic request, flow completes |

---

## How to Extend

### Add a new scenario to an existing category

Add a new object to the relevant JSON file in `data/api/chat/`:

```json
{
  "username": "demo",
  "password": "demo1234",
  "name": "My new scenario @tag1 @tag2",
  "tags": ["tag1", "tag2"],
  "maxTurns": 10,
  "initialRequest": "I want to apply for leave",
  "inputJson": {
    "employee": "Alice",
    "leave_type": "Annual"
  },
  "finalJson": {
    "employee": "Alice",
    "leave_type": "Annual"
  },
  "expectedReferenceIdPrefix": "LVE"
}
```

For negative scenarios — set `"finalJson": {}` to skip submission and assertion.

### Add a new scenario category

1. Create `data/api/chat/chat-leave-{category}.json`
2. Add filename to `DATA_FILES` array in `tests/api/chat/chat-leave-api.spec.ts`
3. Done — spec handles the rest automatically

### Add a new schema (expense, IT ticket, employee)

1. Create `data/api/chat/chat-expense.json`
2. Copy `tests/api/chat/chat-leave-api.spec.ts` → `chat-expense-api.spec.ts`
3. Update `DATA_FILES` and `expectedReferenceIdPrefix` to `EXP`

---

## Framework

Built on `simple-playwright-framework` — a custom npm package developed by the candidate.

- **npm:** https://www.npmjs.com/package/simple-playwright-framework
- **GitHub:** https://github.com/Udayakumarg/simpleplaywrightframework

### Key features

| Feature | Purpose |
|---|---|
| `scenarioLoader(file, dataFileName?)` | Loads JSON scenario arrays, env + tag filtering |
| `envConfigFixture` | Injects baseUrl, apiUrl, authStorage into tests |
| `dataFixture` | Loads test data from matching JSON file |
| `initAuthSession` | UI auth with localStorage token caching |
| `initApiAuthSession` | API auth with JWT token file caching |

---

## OutSystems ODC Compatibility

This suite tests a Spring Boot reference implementation with the identical conversational pattern as the NEXUS OutSystems ODC application. To connect to a live OutSystems environment:

| Change | Where |
|---|---|
| Update API endpoint URLs | `config/environments.json` |
| Update auth mechanism | `auth/nexus.login.ts` and `auth/nexus.api.login.ts` |
| Add `data-testid` to UI elements | OutSystems Extended Properties panel |
| Map schemas to ODC action names | `data/api/chat/*.json` — update `initialRequest` |
| Update reference ID regex | STEP 5 in spec files |

No spec file changes required — all environment config is external.

---

## Known Failures — Documented Bugs

Three scenarios consistently fail — **real bugs, not test issues:**

| Scenario | Failure | Root Cause |
|---|---|---|
| Max length reason | AI ends conversation after long text | R_LONGCONV — token degradation causes context loss |
| Special chars in Arabic | Date fields cross-contaminated | Special chars in free-text affect adjacent field values |
| Arabic reason with emoji | Wrong reason value stored | Emoji disrupts OpenAI answer picker field matching |

These are documented in D3 as production findings with timestamps.

---

## Cost

A full suite run (44 API scenarios, single worker) costs approximately **$0.4 in OpenAI API usage** at current GPT-4o-mini pricing.

---

*Test suite authored by QA Lead candidate — 13 years experience — March 2026*
