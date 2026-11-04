import type { Auth, SignedIn } from "./auth.js";
import type { SignInConfig } from "./config.js";
import { shellPath } from "./address.js";

// Signing in with an OpenID Connect provider, such as a Cognito user pool's managed login, by the
// authorization code flow with PKCE: the shell has no client secret, so it proves it's the one that
// asked by holding the verifier whose hash it sent. Tokens are kept for the browser tab's session.

const pendingKey = "featurewise.signin";
const tokensKey = "featurewise.tokens";

interface Pending {
  state: string;
  verifier: string;
  returnTo: string;
}

interface Tokens {
  accessToken: string;
  idToken?: string;
  expiresAt: number;
}

export interface OidcOptions {
  storage?: Storage;
  // Where the shell is, such as https://d123.cloudfront.net, which its callback page is under.
  origin?: string;
  go?: (url: string) => void;
  fetcher?: typeof fetch;
  now?: () => number;
}

export function oidcAuth(settings: SignInConfig, options: OidcOptions = {}): Auth {
  const storage = options.storage ?? sessionStorage;
  const origin = options.origin ?? location.origin;
  const go = options.go ?? (url => location.assign(url));
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? Date.now;
  const redirectUri = origin + shellPath("callback");
  const listeners: (() => void)[] = [];
  const changed = () => listeners.forEach(listener => listener());

  const read = <T>(key: string): T | null => {
    try {
      return JSON.parse(storage.getItem(key) ?? "null") as T | null;
    } catch {
      return null;
    }
  };

  return {
    current(): SignedIn | null {
      const tokens = read<Tokens>(tokensKey);
      if (!tokens || tokens.expiresAt <= now())
        return null;
      return { username: usernameOf(tokens), token: tokens.accessToken };
    },

    users: () => [],

    signInAs() {
      throw new Error("there's no switching user with a real sign-in");
    },

    async signIn(returnTo) {
      const verifier = randomString(48);
      const state = randomString(24);
      storage.setItem(pendingKey, JSON.stringify({ state, verifier, returnTo } satisfies Pending));
      const query = new URLSearchParams({
        response_type: "code",
        client_id: settings.clientId,
        redirect_uri: redirectUri,
        scope: (settings.scopes ?? ["openid"]).join(" "),
        state,
        code_challenge: await challengeOf(verifier),
        code_challenge_method: "S256"
      });
      go(`${settings.authorizeUrl}?${query}`);
    },

    async completeSignIn(search) {
      const query = new URLSearchParams(search);
      const pending = read<Pending>(pendingKey);
      storage.removeItem(pendingKey);
      if (query.has("error"))
        throw new Error(`signing in failed: ${query.get("error_description") ?? query.get("error")}`);
      const code = query.get("code");
      if (!pending || !code || query.get("state") !== pending.state)
        throw new Error("signing in didn't come back as it set out; try again");

      const response = await fetcher(settings.tokenUrl, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: settings.clientId,
          code,
          redirect_uri: redirectUri,
          code_verifier: pending.verifier
        }).toString()
      });
      if (!response.ok)
        throw new Error(`signing in failed: the provider answered ${response.status}`);

      const body = await response.json() as { access_token: string; id_token?: string; expires_in: number };
      storage.setItem(tokensKey, JSON.stringify({
        accessToken: body.access_token,
        idToken: body.id_token,
        expiresAt: now() + body.expires_in * 1000
      } satisfies Tokens));
      changed();
      return pending.returnTo;
    },

    signOut() {
      storage.removeItem(tokensKey);
      changed();
      go(settings.logoutUrl);
    },

    onChange: listener => { listeners.push(listener); }
  };
}

// The name to show: from the ID token if there is one, otherwise the access token.
function usernameOf(tokens: Tokens): string {
  const claims = { ...claimsOf(tokens.accessToken), ...(tokens.idToken ? claimsOf(tokens.idToken) : {}) };
  const name = claims["cognito:username"] ?? claims["preferred_username"] ?? claims["username"] ?? claims["email"] ?? claims["sub"];
  return typeof name === "string" ? name : "signed in";
}

function claimsOf(token: string): Record<string, unknown> {
  try {
    const payload = token.split(".")[1] ?? "";
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(base64), c => c.charCodeAt(0))));
  } catch {
    return {};
  }
}

function randomString(bytes: number): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

async function challengeOf(verifier: string): Promise<string> {
  return base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}
