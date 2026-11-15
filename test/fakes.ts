import type { Auth } from "../src/auth.js";
import type { ShellConfig } from "../src/config.js";
import { isLink, type Link, type ServiceModule } from "../src/contract.js";

export const config: ShellConfig = {
  default: "/sample/things",
  services: { sample: { module: "/modules/sample/index.js", bff: "/api/sample" } },
  devUsers: [{ username: "ann", groups: ["editor"] }, { username: "bob" }]
};

export const things: Link = { $query: "sample/Things" };

// A module that gives Things the address "things", and renders nothing itself unless told to.
export function module(render: ServiceModule["render"] = () => null): ServiceModule {
  return {
    addressToLink: address => (address === "things" ? things : null),
    linkToAddress: link => (link.$query === "sample/Things" ? "things" : null),
    render
  };
}

export interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

// A fetch that records each request and answers it with the next of the given responses.
export function fetcher(...responses: { status?: number; contentType?: string; family?: string; body: unknown }[]) {
  const calls: Call[] = [];
  const fetch = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(url),
      method: init?.method ?? "GET",
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body as string | undefined
    });
    const next = responses.shift() ?? { body: {} };
    return new Response(typeof next.body === "string" ? next.body : JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: {
        "content-type": next.contentType ?? "application/json; charset=utf-8",
        ...(next.family ? { "featurewise-family": next.family } : {})
      }
    });
  };
  return { fetch: fetch as typeof globalThis.fetch, calls };
}

export function signedOut(): Auth {
  return { current: () => null, personas: () => [], signInAs: () => {}, signOut: () => {}, onChange: () => {} };
}

export function signedIn(token = "a-token"): Auth {
  return { ...signedOut(), current: () => ({ username: "ann", token }) };
}

export const linkIn = (value: unknown): Link => {
  if (!isLink(value))
    throw new Error("not a link");
  return value;
};
