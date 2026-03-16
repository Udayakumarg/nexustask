import { Page } from '@playwright/test';
import { AuthProvider } from 'simple-playwright-framework';

export class NexusLogin implements AuthProvider {
  constructor(private creds: { username: string; password: string }) {}

  async login(page: Page): Promise<void> {
    console.log(`[NexusLogin] Logging in as: ${this.creds.username}`);

    // Navigate if page is blank — happens when initAuthSession
    // is called before page.goto in the spec
    const currentUrl = page.url();
    if (currentUrl === 'about:blank' || currentUrl === '') {
      const baseUrl = process.env.BASE_URL || 'https://nexus-ai-wn4h.onrender.com';
      console.log(`[NexusLogin] Navigating to: ${baseUrl}`);
      await page.goto(baseUrl);
    }

    await page.getByTestId('login-username-input').fill(this.creds.username);
    await page.getByTestId('login-password-input').fill(this.creds.password);
    await page.getByTestId('auth-submit-btn').click();

    // Wait for token to be written to localStorage
    await page.waitForFunction(() => !!localStorage.getItem('token'), { timeout: 10000 });
    console.log(`[NexusLogin] ✅ Token stored, login complete`);
  }
}