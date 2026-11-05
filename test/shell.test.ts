import { beforeEach, describe, expect, it } from "vitest";
import type { ServiceModule, ShellResponse } from "../src/contract.js";
import { devAuth } from "../src/auth.js";
import { Shell, type ShellOptions } from "../src/shell.js";
import { config, fetcher, module, signedIn, things } from "./fakes.js";

describe("the shell", () => {
  let main: HTMLElement;
  let toasts: string[];

  beforeEach(() => {
    document.body.replaceChildren();
    main = document.createElement("main");
    document.body.append(main);
    toasts = [];
    history.replaceState(null, "", "/");
  });

  function shell(serviceModule: ServiceModule, fetch: typeof globalThis.fetch, options: Partial<ShellOptions> = {}) {
    return new Shell({
      config,
      auth: signedIn(),
      main,
      toaster: { show: message => toasts.push(message) },
      importModule: async () => ({ default: serviceModule }),
      fetcher: fetch,
      ...options
    });
  }

  const thingsResult = { Things: [{ Thing: { Id: "t1", Name: "Teapot" }, LinkToDelete: { $feature: "sample/DeleteThing", Id: "t1" } }] };

  it("goes from / to the default address, and loads its link by GET", async () => {
    const { fetch, calls } = fetcher({ body: thingsResult });

    await shell(module(), fetch).start();

    expect(location.pathname).toBe("/sample/things");
    expect(calls[0]!.method).toBe("GET");
    expect(calls[0]!.url).toContain("/api/sample/Things?link=");
    expect(main.textContent).toContain("Teapot");
  });

  it("shows a result with the module's handler when it has one", async () => {
    const { fetch } = fetcher({ body: thingsResult });
    const handled: ShellResponse[] = [];
    const custom = module((element, response) => {
      handled.push(response);
      element.textContent = "handled";
      return () => {};
    });

    await shell(custom, fetch).start();

    expect(main.textContent).toBe("handled");
    expect(handled[0]).toMatchObject({ link: things, feature: "sample/Things", status: 200, contentType: "application/json" });
  });

  it("moves the URL to a followed query's address, but not to a command's", async () => {
    const { fetch, calls } = fetcher({ body: thingsResult }, { body: { $case: "Deleted" } }, { body: thingsResult });
    const theShell = shell(module(), fetch);
    await theShell.start();
    history.replaceState(null, "", "/sample/elsewhere");

    await theShell.follow({ $feature: "sample/DeleteThing", Id: "t1" });
    expect(location.pathname).toBe("/sample/elsewhere");
    expect(calls[1]!.method).toBe("POST");

    await theShell.follow(things);
    expect(location.pathname).toBe("/sample/things");
  });

  it("toasts a problem's detail and leaves the page as it was", async () => {
    const { fetch } = fetcher(
      { body: thingsResult },
      { status: 404, contentType: "application/problem+json", body: { title: "Not found", status: 404, detail: "there is no feature named Nothing" } });
    const theShell = shell(module(), fetch);
    await theShell.start();

    await theShell.follow({ $feature: "sample/Nothing" });

    expect(toasts).toEqual(["there is no feature named Nothing"]);
    expect(main.textContent).toContain("Teapot");
  });

  it("asks for sign-in on a 401, and says no on a 403", async () => {
    const problem = (status: number) => ({ status, contentType: "application/problem+json", body: { status } });
    const { fetch } = fetcher({ body: thingsResult }, problem(401), problem(403));
    let signInAsked = false;
    const theShell = shell(module(), fetch, { needsSignIn: () => { signInAsked = true; } });
    await theShell.start();

    await theShell.follow({ $feature: "sample/DeleteThing", Id: "t1" });
    await theShell.follow({ $feature: "sample/DeleteThing", Id: "t1" });

    expect(signInAsked).toBe(true);
    expect(toasts).toEqual(["Sign in to do that.", "You may not do that."]);
  });

  it("sends the signed-in user's token", async () => {
    const { fetch, calls } = fetcher({ body: thingsResult });

    await shell(module(), fetch, { auth: signedIn("ann-token") }).start();

    expect(calls[0]!.headers["authorization"]).toBe("Bearer ann-token");
  });

  it("keeps links followed inside an embedded element there, and tells whoever embedded it", async () => {
    const { fetch } = fetcher({ body: thingsResult }, { body: { Picked: "t1" } });
    const heard: ShellResponse[] = [];
    let embedded: HTMLElement | null = null;
    const embedding = module((element, response, host) => {
      if (response.feature !== "sample/Things")
        return null;
      embedded = element.ownerDocument.createElement("div");
      element.append(embedded);
      host.embed(embedded, { $feature: "sample/Picker" }, picked => heard.push(picked));
      return () => {};
    });

    await shell(embedding, fetch).start();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(heard[0]?.body).toEqual({ Picked: "t1" });
    expect(embedded!.textContent).toContain("t1");
    expect(location.pathname).toBe("/sample/things");
  });

  it("shows its services page, with each service's backend", async () => {
    const theShell = shell(module(), fetcher().fetch);

    await theShell.openServices();

    expect(location.pathname).toBe("/_shell/services");
    expect(main.querySelector("td:last-child")!.textContent).toBe("http://localhost/api/sample");
  });

  it("says so when an address means nothing to the service", async () => {
    history.replaceState(null, "", "/sample/nowhere");

    await shell(module(), fetcher().fetch).load();

    expect(main.textContent).toBe("There's nothing at this address.");
  });

  it("finishes signing in on its callback page, and goes back where the user was", async () => {
    const { fetch } = fetcher({ body: thingsResult });
    const completed: string[] = [];
    const auth = { ...signedIn(), completeSignIn: async (search: string) => { completed.push(search); return "/sample/things"; } };
    history.replaceState(null, "", "/_shell/callback?code=c&state=s");

    await shell(module(), fetch, { auth }).load();

    expect(completed).toEqual(["?code=c&state=s"]);
    expect(location.pathname).toBe("/sample/things");
    expect(main.textContent).toContain("Teapot");
  });

  it("toasts when the backend can't be reached", async () => {
    const failing = (async () => { throw new TypeError("offline"); }) as typeof globalThis.fetch;
    history.replaceState(null, "", "/sample/things");

    await shell(module(), failing).load();

    expect(toasts).toEqual(["Something went wrong. Try again."]);
  });

  it("becomes the persona ?as= names, and leaves it out of the address", async () => {
    localStorage.clear();
    const { fetch, calls } = fetcher({ body: thingsResult });
    const auth = devAuth([{ id: "ann" }, { id: "bob" }]);
    const theShell = shell(module(), fetch, { auth });
    auth.onChange(() => void theShell.load());
    history.replaceState(null, "", "/sample/things?as=bob");

    await theShell.start();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(auth.current()?.username).toBe("bob");
    expect(location.pathname + location.search).toBe("/sample/things");
    expect(calls.length).toBe(1);
  });

  it("says so when ?as= names nobody, and loads the page anyway", async () => {
    const { fetch } = fetcher({ body: thingsResult });
    history.replaceState(null, "", "/sample/things?as=nobody");

    await shell(module(), fetch).start();

    expect(toasts).toContain("There's no persona called nobody.");
    expect(main.textContent).toContain("Teapot");
  });

  it("finishes signing in once, though the sign-in loads the page again while it's at the callback", async () => {
    const { fetch } = fetcher({ body: thingsResult }, { body: thingsResult });
    let completions = 0;
    let theShell: Shell | null = null;
    const auth = {
      ...signedIn(),
      completeSignIn: async () => {
        completions++;
        void theShell!.load();   // as the shell's listener does when the user changes
        return "/sample/things";
      }
    };
    theShell = shell(module(), fetch, { auth });
    history.replaceState(null, "", "/_shell/callback?code=c&state=s");

    await theShell.start();

    expect(completions).toBe(1);
    expect(toasts).toEqual([]);
    expect(location.pathname).toBe("/sample/things");
  });
});
