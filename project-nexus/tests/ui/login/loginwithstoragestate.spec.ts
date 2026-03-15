import { test, expect, initAuthSession } from "simple-playwright-framework";
import { providerRegistry } from "@project-nexus/auth";

test("Nexus UI smoke", async ({ page, envConfig, td }) => {
  await page.goto(envConfig.baseUrl);
  await initAuthSession(
    page,
    envConfig.authStorage,
    {
      username: td.users.admin.username,
      password: td.users.admin.password,
    },
    providerRegistry,
  );

  // now you're logged in, messages-container is visible
  await expect(page.getByTestId("messages-container")).toBeVisible();
});
