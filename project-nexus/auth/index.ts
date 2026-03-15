import { NexusLogin }    from "./nexus.login";
import { NexusApiLogin } from "./nexus.api.login";
export const providerRegistry = {
  NexusLogin,
};

export function getApiProviderRegistry(apiUrl: string) {
  return {
    NexusLogin: class extends NexusApiLogin {
      constructor(creds: { username: string; password: string }) {
        super(creds, apiUrl);
      }
    }
  };
}