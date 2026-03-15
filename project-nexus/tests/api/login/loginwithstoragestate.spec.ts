import { test, expect } from 'simple-playwright-framework';
import { initApiAuthSession } from 'simple-playwright-framework';
import { apiProviderRegistry } from '@project-nexus/auth';

test('my test', async ({ request, envConfig, td }) => {
  const token = await initApiAuthSession(
    request,
    envConfig.authStorage,
    { username: td.username, password: td.password },
    apiProviderRegistry
  );
});