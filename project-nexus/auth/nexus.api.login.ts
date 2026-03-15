import { ApiAuthProvider } from 'simple-playwright-framework';

export class NexusApiLogin implements ApiAuthProvider {
  constructor(
    private creds:  { username: string; password: string },
    private apiUrl: string
  ) {}

  async getToken(request: any): Promise<string> {
    const res = await request.post(`${this.apiUrl}/api/v1/auth/login`, {
      data: {
        username: this.creds.username,
        password: this.creds.password,
      },
    });
    const data = await res.json();
    if (!data.success) throw new Error(`[NexusApiLogin] Login failed: ${data.message}`);
    return data.data.accessToken;
  }
}