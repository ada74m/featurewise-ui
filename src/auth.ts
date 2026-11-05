import type { Persona } from "./config.js";

// Who's signed in. Where there's no real sign-in, as on the local host, a developer picks a persona and
// the shell makes an unsigned token with the claims Cognito's would have, which only the local host
// accepts. Elsewhere, people sign in with the environment's identity provider; see oidc.ts.

const storageKey = "featurewise.user";

export interface SignedIn {
  // The persona's id, or whatever name the token carries.
  username: string;
  token: string;
}

export interface Auth {
  current(): SignedIn | null;
  // Who a visitor can be, or empty where the sign-in has no personas.
  personas(): Persona[];
  // Becomes the persona, coming back to returnTo: at once with no real sign-in, or by way of the
  // sign-in, which signs a persona in without asking.
  signInAs(persona: Persona, returnTo?: string): void;
  // Real sign-in only: goes to the identity provider's sign-in page, to come back to returnTo, naming
  // the persona to sign in as if there is one.
  signIn?(returnTo: string, loginHint?: string): Promise<void>;
  // Real sign-in only: finishes signing in when the provider sends the user back to the shell's
  // callback page with the given query string, and says where to go next.
  completeSignIn?(search: string): Promise<string>;
  signOut(): void;
  onChange(listener: () => void): void;
}

export function devAuth(personas: Persona[], storage: Storage = localStorage): Auth {
  const listeners: (() => void)[] = [];
  const changed = () => listeners.forEach(listener => listener());

  return {
    current() {
      const stored = storage.getItem(storageKey);
      const persona = personas.find(p => p.id === stored);
      return persona ? { username: persona.id, token: unsignedToken(persona) } : null;
    },
    personas: () => personas,
    signInAs(persona) {
      storage.setItem(storageKey, persona.id);
      changed();
    },
    signOut() {
      storage.removeItem(storageKey);
      changed();
    },
    onChange: listener => { listeners.push(listener); }
  };
}

// A JWT with the persona's claims and no signature, as the local host reads them.
export function unsignedToken(persona: Persona): string {
  const claims = { username: persona.id, "cognito:groups": persona.groups ?? [] };
  return `none.${base64Url(JSON.stringify(claims))}.none`;
}

function base64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}
