import type { DevUser } from "./config.js";

// Who's signed in. Where there's no real sign-in, as on the local host, a developer picks a user and
// the shell makes an unsigned token with the claims Cognito's would have, which only the local host
// accepts. Real sign-in comes when the shell is hosted on AWS.

const storageKey = "featurewise.user";

export interface SignedIn {
  username: string;
  token: string;
}

export interface Auth {
  current(): SignedIn | null;
  // The users a developer can switch to, or empty where there's real sign-in.
  users(): DevUser[];
  signInAs(user: DevUser): void;
  signOut(): void;
  onChange(listener: () => void): void;
}

export function devAuth(users: DevUser[], storage: Storage = localStorage): Auth {
  const listeners: (() => void)[] = [];
  const changed = () => listeners.forEach(listener => listener());

  return {
    current() {
      const stored = storage.getItem(storageKey);
      const user = users.find(u => u.username === stored);
      return user ? { username: user.username, token: unsignedToken(user) } : null;
    },
    users: () => users,
    signInAs(user) {
      storage.setItem(storageKey, user.username);
      changed();
    },
    signOut() {
      storage.removeItem(storageKey);
      changed();
    },
    onChange: listener => { listeners.push(listener); }
  };
}

// A JWT with the user's claims and no signature, as the local host reads them.
export function unsignedToken(user: DevUser): string {
  const claims = { username: user.username, "cognito:groups": user.groups ?? [] };
  return `none.${base64Url(JSON.stringify(claims))}.none`;
}

function base64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}
