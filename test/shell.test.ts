import { beforeEach, describe, expect, it } from "vitest";
import type { ServiceModule, ShellResponse } from "../src/contract.js";
import { devAuth } from "../src/auth.js";
import { storedCustomisations } from "../src/customisation.js";
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

  const thingsResult = { Things: [{ Thing: { Id: "t1", Name: "Teapot" }, LinkToDelete: { $command: "sample/DeleteThing", Id: "t1" } }] };

  it("goes from / to the default address, and loads its link by GET", async () => {
    const { fetch, calls } = fetcher({ body: thingsResult });

    await shell(module(), fetch).start();

    expect(location.pathname).toBe("/sample/things");
    expect(calls[0]!.method).toBe("GET");
    expect(calls[0]!.url).toContain("/api/sample/Things?link=");
    expect(main.textContent).toContain("Teapot");
  });

  it("shows the demos' home page at /, where there are demos, without invoking anything", async () => {
    const { fetch, calls } = fetcher();

    await shell(module(), fetch, { config: { ...config, title: "Featurewise demos", demos: [{ id: "sample", title: "The sample" }] } }).start();

    expect(location.pathname).toBe("/");
    expect(calls).toHaveLength(0);
    expect(main.querySelector("h1")!.textContent).toBe("Featurewise demos");
    expect(main.textContent).toContain("The sample");
  });

  it("turns a service's module's rendering off and on, and shows the page again", async () => {
    const { fetch } = fetcher({ body: thingsResult }, { body: thingsResult });
    const custom = module(element => {
      element.textContent = "handled";
      return () => {};
    });
    const theShell = shell(custom, fetch, { customisations: storedCustomisations(sessionStorage) });
    await theShell.start();
    expect(theShell.rendersModule("sample")).toBe(true);

    await theShell.setRendering("sample", false);

    expect(theShell.rendersModule("sample")).toBe(false);
    expect(main.textContent).toContain("Teapot");
    sessionStorage.clear();
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

    await theShell.follow({ $command: "sample/DeleteThing", Id: "t1" });
    expect(location.pathname).toBe("/sample/elsewhere");
    expect(calls[1]!.method).toBe("POST");

    await theShell.follow(things);
    expect(location.pathname).toBe("/sample/things");
  });

  it("gives a query the module has no address for the shell's default one, and loads it again from there", async () => {
    const { fetch, calls } = fetcher({ body: thingsResult }, { family: "query", body: {} }, { body: {} });
    const theShell = shell(module(), fetch);
    await theShell.start();
    const search = { $query: "sample/SearchThings", Name: "Tea" };

    await theShell.follow(search);
    expect(location.pathname + decodeURIComponent(location.search)).toBe('/sample/_/SearchThings?link={"Name":"Tea"}');

    await theShell.load();
    expect(calls[2]!.method).toBe("GET");
    expect(calls[2]!.url).toBe(`/api/sample/SearchThings?link=${encodeURIComponent(JSON.stringify(search))}`);
  });

  it("follows a link to a query with a GET, and a link to a command with a POST", async () => {
    const { fetch, calls } = fetcher({ body: thingsResult }, { body: thingsResult }, { body: {} });
    const theShell = shell(module(), fetch);
    await theShell.start();

    await theShell.follow(things);
    await theShell.follow({ $command: "sample/DeleteThing", Id: "t1" });

    expect(calls.map(call => call.method)).toEqual(["GET", "GET", "POST"]);
  });

  it("gives no address to a command", async () => {
    const { fetch } = fetcher({ body: thingsResult }, { body: {} });
    const theShell = shell(module(), fetch);
    await theShell.start();

    await theShell.follow({ $command: "sample/RenameThing", Id: "t1" });

    expect(location.pathname).toBe("/sample/things");
  });

  it("lends a module the path of a link, for an href: the module's address, or else the shell's default", async () => {
    const { fetch } = fetcher({ body: thingsResult });
    const paths: (string | null)[] = [];
    const asking = module((element, _, host) => {
      paths.push(
        host.pathOf(things),
        host.pathOf({ $query: "sample/SearchThings", Name: "Tea" }),
        host.pathOf({ $query: "elsewhere/Things" }),
        host.pathOf({ $query: "unqualified" }));
      element.textContent = "asked";
      return () => {};
    });

    await shell(asking, fetch).start();

    expect(paths.map(path => path && decodeURIComponent(path))).toEqual(
      ["/sample/things", '/sample/_/SearchThings?link={"Name":"Tea"}', null, null]);
  });

  it("gives a link to another service the path its module gives, once that module is loaded", async () => {
    const { fetch } = fetcher({ body: thingsResult }, { body: {} }, { body: thingsResult });
    const shop: ServiceModule = {
      addressToLink: () => null,
      linkToAddress: link => (link.$query === "shop/Aisles" ? "aisles" : null),
      render: () => null
    };
    const paths: (string | null)[] = [];
    const asking = module((element, _, host) => {
      paths.push(host.pathOf({ $query: "shop/Aisles" }));
      element.textContent = "asked";
      return () => {};
    });
    const theShell = shell(asking, fetch, {
      config: { ...config, services: { ...config.services, shop: { module: "/modules/shop/index.js", bff: "/api/shop" } } },
      importModule: async url => ({ default: url.includes("/shop/") ? shop : asking })
    });

    await theShell.start();
    await theShell.follow({ $query: "shop/Aisles" });
    await theShell.follow(things);

    expect(paths).toEqual(["/shop/_/Aisles", "/shop/aisles"]);
  });

  it("toasts a problem's detail and leaves the page as it was", async () => {
    const { fetch } = fetcher(
      { body: thingsResult },
      { status: 404, contentType: "application/problem+json", body: { title: "Not found", status: 404, detail: "there is no feature named Nothing" } });
    const theShell = shell(module(), fetch);
    await theShell.start();

    await theShell.follow({ $command: "sample/Nothing" });

    expect(toasts).toEqual(["there is no feature named Nothing"]);
    expect(main.textContent).toContain("Teapot");
  });

  it("asks for sign-in on a 401, and says no on a 403", async () => {
    const problem = (status: number) => ({ status, contentType: "application/problem+json", body: { status } });
    const { fetch } = fetcher({ body: thingsResult }, problem(401), problem(403));
    let signInAsked = false;
    const theShell = shell(module(), fetch, { needsSignIn: () => { signInAsked = true; } });
    await theShell.start();

    await theShell.follow({ $command: "sample/DeleteThing", Id: "t1" });
    await theShell.follow({ $command: "sample/DeleteThing", Id: "t1" });

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
      host.embed(embedded, { $query: "sample/Picker" }, picked => heard.push(picked));
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
    expect(main.querySelector("td:nth-child(2)")!.textContent).toBe("http://localhost/api/sample");
  });

  it("renders generically when the module's rendering is turned off", async () => {
    localStorage.clear();
    const customisations = storedCustomisations();
    customisations.set("sample", { render: false });
    const { fetch } = fetcher({ body: thingsResult }, { body: thingsResult });
    const custom = module(element => {
      element.textContent = "handled";
      return () => {};
    });
    const theShell = shell(custom, fetch, { customisations });
    await theShell.start();

    await theShell.follow(things);

    expect(main.textContent).toContain("Teapot");
    localStorage.clear();
  });

  it("turns a module's rendering on and off on its services page", async () => {
    localStorage.clear();
    const customisations = storedCustomisations();
    await shell(module(), fetcher().fetch, { customisations }).openServices();

    const render = main.querySelector<HTMLInputElement>("input[name=sample-render]")!;
    expect(render.checked).toBe(true);
    render.checked = false;
    render.dispatchEvent(new Event("change"));

    expect(customisations.of("sample")).toEqual({ render: false });
    localStorage.clear();
  });

  it("shows a service plain or dressed as ?view= says, remembers it, and leaves it out of the address", async () => {
    localStorage.clear();
    const customisations = storedCustomisations();
    const { fetch } = fetcher({ body: thingsResult }, { body: thingsResult });
    const custom = module(element => {
      element.textContent = "handled";
      return () => {};
    });
    history.replaceState(null, "", "/sample/things?view=plain");

    await shell(custom, fetch, { customisations }).start();
    expect(location.pathname + location.search).toBe("/sample/things");
    expect(main.textContent).toContain("Teapot");
    expect(customisations.of("sample").render).toBe(false);

    history.replaceState(null, "", "/sample/things?view=dressed");
    await shell(custom, fetch, { customisations }).load();
    expect(main.textContent).toBe("handled");
    localStorage.clear();
  });

  it("says so when ?view= names no view, and loads the page anyway", async () => {
    const { fetch } = fetcher({ body: thingsResult });
    history.replaceState(null, "", "/sample/things?view=fancy");

    await shell(module(), fetch).start();

    expect(toasts).toContain("There's no view called fancy: it's plain or dressed.");
    expect(main.textContent).toContain("Teapot");
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

  it("runs a command of its own, says it's done, and loads the page again", async () => {
    const { fetch, calls } = fetcher({ body: thingsResult }, { body: { Demo: "sample" } }, { body: thingsResult });
    const theShell = shell(module(), fetch);
    await theShell.start();

    await theShell.runAndReload({ $command: "sample/ResetDemo", Demo: "sample" }, "Started again.");

    expect(calls.map(call => call.method)).toEqual(["GET", "POST", "GET"]);
    expect(toasts).toEqual(["Started again."]);
  });
});
