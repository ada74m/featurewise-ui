import { beforeEach, describe, expect, it } from "vitest";
import { oidcAuth } from "../src/oidc.js";

const settings = {
  authorizeUrl: "https://auth.example.com/oauth2/authorize",
  tokenUrl: "https://auth.example.com/oauth2/token",
  logoutUrl: "https://auth.example.com/logout?client_id=shell&logout_uri=https%3A%2F%2Fshell.example.com%2F",
  clientId: "shell"
};

const token = (claims: object) =>
  `x.${btoa(JSON.stringify(claims)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_")}.x`;

describe("signing in with an OpenID Connect provider", () => {
  let visited: string[];
  let posted: { url: string; body: URLSearchParams }[];
  let clock: number;

  beforeEach(() => {
    sessionStorage.clear();
    visited = [];
    posted = [];
    clock = 1_000_000;
  });

  const auth = (answer = { access_token: token({ username: "ann" }), id_token: token({ "cognito:username": "ann" }), expires_in: 3600 }) =>
    oidcAuth(settings, [], {
      origin: "https://shell.example.com",
      go: url => visited.push(url),
      now: () => clock,
      fetcher: (async (url: string, init: RequestInit) => {
        posted.push({ url, body: new URLSearchParams(init.body as string) });
        return new Response(JSON.stringify(answer), { status: 200 });
      }) as unknown as typeof fetch
    });

  it("goes to the provider with a PKCE challenge, to come back to the shell's callback", async () => {
    await auth().signIn!("/sample/things");

    const url = new URL(visited[0]!);
    expect(url.origin + url.pathname).toBe(settings.authorizeUrl);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("shell");
    expect(url.searchParams.get("redirect_uri")).toBe("https://shell.example.com/_shell/callback");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(url.searchParams.get("scope")).toBe("openid");
  });

  it("trades the code and its verifier for tokens, and goes back where the user was", async () => {
    const signIn = auth();
    await signIn.signIn!("/sample/things");
    const state = new URL(visited[0]!).searchParams.get("state");

    const returnTo = await signIn.completeSignIn!(`?code=the-code&state=${state}`);

    expect(returnTo).toBe("/sample/things");
    expect(posted[0]!.url).toBe(settings.tokenUrl);
    expect(posted[0]!.body.get("grant_type")).toBe("authorization_code");
    expect(posted[0]!.body.get("code")).toBe("the-code");
    expect(posted[0]!.body.get("code_verifier")).toMatch(/^[A-Za-z0-9_-]{64}$/);
    expect(signIn.current()).toMatchObject({ username: "ann" });
  });

  it("refuses a callback whose state isn't the one it sent", async () => {
    const signIn = auth();
    await signIn.signIn!("/");

    await expect(signIn.completeSignIn!("?code=the-code&state=forged")).rejects.toThrow();
    expect(posted).toEqual([]);
    expect(signIn.current()).toBeNull();
  });

  it("forgets the user when the access token expires", async () => {
    const signIn = auth();
    await signIn.signIn!("/");
    await signIn.completeSignIn!(`?code=c&state=${new URL(visited[0]!).searchParams.get("state")}`);

    clock += 3600 * 1000;

    expect(signIn.current()).toBeNull();
  });

  it("signs out at the provider too", async () => {
    const signIn = auth();
    await signIn.signIn!("/");
    await signIn.completeSignIn!(`?code=c&state=${new URL(visited[0]!).searchParams.get("state")}`);

    signIn.signOut();

    expect(signIn.current()).toBeNull();
    expect(visited.at(-1)).toBe(settings.logoutUrl);
  });

  it("becomes a persona by naming it in the login hint, to come back where the visitor was", async () => {
    const signIn = oidcAuth(settings, [{ id: "clerk", demo: "lost-property" }], { origin: "https://shell.example.com", go: url => visited.push(url) });

    signIn.signInAs({ id: "clerk" }, "/demos/lost-property/unclaimed-items");
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(new URL(visited[0]!).searchParams.get("login_hint")).toBe("clerk");
    expect(JSON.parse(sessionStorage.getItem("featurewise.signin")!).returnTo).toBe("/demos/lost-property/unclaimed-items");
    expect(signIn.personas()).toEqual([{ id: "clerk", demo: "lost-property" }]);
  });
});
