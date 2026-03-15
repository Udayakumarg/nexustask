// ════════════════════════════════════════════════════════════════
// project-nexus/pages/ChatPage.ts
//
// Page Object Model for the Nexus chat main panel.
// Wraps all data-testid selectors and exposes clean action methods.
//
// Covers:
//   - Message input and send
//   - Waiting for AI response
//   - Reading last AI message
//   - Confirmation detection and buttons
//   - Header indicators (schema, title, lang badge)
// ════════════════════════════════════════════════════════════════

import { Page, Locator, expect } from "@playwright/test";

export class ChatPage {
  private page: Page;

  // ── Locators ──────────────────────────────────────────────────
  readonly messageInput:      Locator;
  readonly sendBtn:           Locator;
  readonly messagesContainer: Locator;
  readonly typingIndicator:   Locator;
  readonly confirmYesBtn:     Locator;
  readonly confirmNoBtn:      Locator;
  readonly confirmBtns:       Locator;
  readonly schemaIndicator:   Locator;
  readonly modelBadge:        Locator;
  readonly convTitle:         Locator;
  readonly langBadge:         Locator;
  readonly emptyState:        Locator;

  constructor(page: Page) {
    this.page             = page;
    this.messageInput     = page.getByTestId("message-input");
    this.sendBtn          = page.getByTestId("send-btn");
    this.messagesContainer= page.getByTestId("messages-container");
    this.typingIndicator  = page.getByTestId("typing-indicator");
    this.confirmYesBtn    = page.getByTestId("confirm-yes-btn");
    this.confirmNoBtn     = page.getByTestId("confirm-no-btn");
    this.confirmBtns      = page.getByTestId("confirm-btns");
    this.schemaIndicator  = page.getByTestId("schema-indicator");
    this.modelBadge       = page.getByTestId("model-badge");
    this.convTitle        = page.getByTestId("conv-title");
    this.langBadge        = page.getByTestId("lang-badge");
    this.emptyState       = page.getByTestId("empty-state");
  }

  // ── Actions ───────────────────────────────────────────────────

  /**
   * Types a message and clicks send.
   * Waits for send button to be enabled before typing.
   */
  async sendMessage(text: string): Promise<void> {
    await this.sendBtn.waitFor({ state: "visible" });
    await this.messageInput.fill(text);
    await this.sendBtn.click();
  }

  /**
   * Waits for the AI to finish responding.
   * Typing indicator appears then disappears when response is ready.
   */
  async waitForResponse(timeout = 60000): Promise<void> {
    // Wait for typing indicator to appear
    await this.typingIndicator
      .waitFor({ state: "visible", timeout: 10000 })
      .catch(() => {}); // may already be gone on fast responses
    // Wait for typing indicator to disappear = response complete
    await this.typingIndicator
      .waitFor({ state: "detached", timeout });
  }

  /**
   * Returns the text content of the last AI assistant message.
   */
  async getLastAssistantMessage(): Promise<string> {
    const messages = this.page.locator('[data-message-role="assistant"]');
    const count    = await messages.count();
    if (count === 0) return "";
    const last    = messages.nth(count - 1);
    const content = last.locator('[data-testid^="message-content-"]');
    return (await content.innerText()).trim();
  }

  /**
   * Checks if the last AI message contains a JSON confirmation block.
   * The backend wraps the form summary in ```json ... ```
   */
  async isConfirmationVisible(): Promise<boolean> {
    const text = await this.getLastAssistantMessage();
    return text.includes("```json") || text.includes("Please confirm") || text.includes("YES");
  }

  /**
   * Clicks the YES confirm button.
   * Waits for the button to be visible first.
   */
  async clickConfirmYes(): Promise<void> {
    await this.confirmYesBtn.waitFor({ state: "visible" });
    await this.confirmYesBtn.click();
  }

  /**
   * Clicks the NO modify button.
   */
  async clickConfirmNo(): Promise<void> {
    await this.confirmNoBtn.waitFor({ state: "visible" });
    await this.confirmNoBtn.click();
  }

  /**
   * Returns the current schema indicator text.
   * e.g. "📋 leave"
   * Returns empty string if not visible.
   */
  async getSchemaIndicator(): Promise<string> {
    const visible = await this.schemaIndicator.isVisible();
    if (!visible) return "";
    return (await this.schemaIndicator.innerText()).trim();
  }

  /**
   * Returns the current conversation title.
   */
  async getConvTitle(): Promise<string> {
    return (await this.convTitle.innerText()).trim();
  }

  /**
   * Returns the language badge text (EN / عربي).
   * Returns empty string if not visible.
   */
  async getLangBadge(): Promise<string> {
    const visible = await this.langBadge.isVisible();
    if (!visible) return "";
    return (await this.langBadge.innerText()).trim();
  }

  /**
   * Asserts the messages container is visible — confirms user is logged in
   * and the chat UI has loaded.
   */
  async assertLoaded(): Promise<void> {
    await expect(this.messagesContainer).toBeVisible();
  }

  /**
   * Clicks a suggestion chip by testid.
   * e.g. clickSuggestion("suggestion-leave")
   */
  async clickSuggestion(testId: string): Promise<void> {
    await this.page.getByTestId(testId).click();
  }
}