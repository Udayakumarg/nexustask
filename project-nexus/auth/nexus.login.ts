import { Page } from '@playwright/test';
import { AuthProvider } from 'simple-playwright-framework';

export class NexusLogin implements AuthProvider {
  constructor(private creds: { username: string; password: string }) {}
  async login(page: Page): Promise<void> {
    console.log(`Navigating to login page... `+this.creds.username);
    await page.getByTestId('login-username-input').fill(this.creds.username);
    await page.getByTestId('login-password-input').fill(this.creds.password);
    await page.getByTestId('auth-submit-btn').click();
    await page.waitForFunction(() => !!localStorage.getItem('token'), { timeout: 10000 });
  }
}