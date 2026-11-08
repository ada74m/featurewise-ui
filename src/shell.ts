import { defaultAddressOf, linkOfDefaultAddress, pathOf, placeOf, shellPath, type Place } from "./address.js";
import type { Auth } from "./auth.js";
import { invoke, isProblem, type Method, type Problem } from "./bff.js";
import type { ShellConfig } from "./config.js";
import { featureOf, type Host, type Link, type ServiceModule, type ShellResponse } from "./contract.js";
import { storedCustomisations, type Customisations } from "./customisation.js";
import { renderGeneric } from "./generic.js";
import { renderServicesPage } from "./servicesPage.js";
import type { Toaster } from "./toast.js";

// Where a result is shown: the page, whose URL follows the links it shows, or an element a component
// embedded, where links followed stay.
interface Frame {
  element: HTMLElement;
  page: boolean;
  onResult?: (response: ShellResponse) => void;
  clear?: () => void;
}

export interface ShellOptions {
  config: ShellConfig;
  auth: Auth;
  main: HTMLElement;
  toaster: Toaster;
  // Called when a request needs someone signed in.
  needsSignIn?: () => void;
  // Called with each place the shell shows, as the persona bar needs.
  onPlace?: (place: Place) => void;
  // Whether to use each module's rendering; yes unless the services page turned it off.
  customisations?: Customisations;
  importModule?: (url: string) => Promise<{ default: ServiceModule }>;
  fetcher?: typeof fetch;
  window?: Window;
}

// The shell: it loads each service's module, invokes every link through the service's UI backend, and
// shows the result with the module's handler, or generically if the module has none. Modules never
// invoke anything.
export class Shell {
  private readonly modules = new Map<string, Promise<ServiceModule>>();
  // The sign-in being finished at the callback, which a load meanwhile waits for rather than repeating.
  private signingIn: Promise<void> | null = null;
  private readonly page: Frame;
  private readonly window: Window;
  private readonly customisations: Customisations;

  constructor(private readonly options: ShellOptions) {
    this.page = { element: options.main, page: true };
    this.window = options.window ?? window;
    this.customisations = options.customisations ?? storedCustomisations();
  }

  start(): Promise<void> {
    this.window.addEventListener("popstate", () => void this.load());
    return this.load();
  }

  // Shows whatever the URL says: the default, a page of the shell's own, or the link a service's
  // address stands for, invoked by GET, since a reload or Back repeats it.
  async load(): Promise<void> {
    const { pathname, search } = this.window.location;

    // ?as=<persona>, as in a link from the book, becomes that persona first, and leaves the address.
    const query = new URLSearchParams(search);
    const as = query.get("as");
    if (as !== null) {
      query.delete("as");
      const rest = `${pathname}${query.size ? `?${query}` : ""}`;
      this.window.history.replaceState(null, "", rest);
      const persona = this.options.auth.personas().find(p => p.id === as);
      if (!persona)
        this.options.toaster.show(`There's no persona called ${as}.`);
      else if (this.options.auth.current()?.username !== as) {
        // Becoming them signs them in, which loads the page again, or goes by way of the sign-in.
        this.options.auth.signInAs(persona, rest);
        return;
      }
      return this.load();
    }

    const place = placeOf(pathname, search);
    this.options.onPlace?.(place);

    if (place.kind === "default") {
      this.window.history.replaceState(null, "", this.options.config.default);
      return this.load();
    }
    if (place.kind === "shell") {
      if (place.page === "callback") {
        // Finishing sign-in says the user changed, which loads the page again while it's still here.
        // It's noted before it starts, so even a load straight away finds it.
        this.signingIn ??= Promise.resolve().then(() => this.completeSignIn(search)).finally(() => { this.signingIn = null; });
        return this.signingIn;
      }
      if (place.page === "services")
        return this.show(this.page, element => renderServicesPage(element, this.options.config, this.window.location.href, this.customisations));
      return this.show(this.page, element => message(element, "There's no such page."));
    }

    const module = await this.moduleOf(place.service);
    if (!module)
      return this.show(this.page, element => message(element, `There's no service called ${place.service}.`));
    let link: Link | null;
    try {
      link = linkOfDefaultAddress(place.service, place.address) ?? module.addressToLink(place.address);
    } catch {
      link = null;
    }
    if (!link)
      return this.show(this.page, element => message(element, "There's nothing at this address."));
    return this.invokeIn(this.page, link, "GET");
  }

  // The identity provider sends the user back here after signing in. Once the tokens are in hand, the
  // shell goes back to where the user was, without leaving the callback in the history.
  private async completeSignIn(search: string): Promise<void> {
    let returnTo = "/";
    try {
      returnTo = await this.options.auth.completeSignIn?.(search) ?? "/";
    } catch (error) {
      this.options.toaster.show(String((error as Error).message));
    }
    this.window.history.replaceState(null, "", returnTo);
    this.signingIn = null;
    return this.load();
  }

  // Opens the shell's services page.
  openServices(): Promise<void> {
    this.window.history.pushState(null, "", shellPath("services"));
    return this.load();
  }

  // Invokes a command for the shell itself, such as starting a demo again, then says so and loads the
  // page again, to show what it changed.
  async runAndReload(link: Link, done: string): Promise<void> {
    const [service] = featureOf(link);
    const config = this.options.config.services[service];
    if (!config) {
      this.options.toaster.show(`There's no service called ${service}.`);
      return;
    }
    let response: ShellResponse;
    try {
      response = await invoke(config.bff, link, "POST", this.options.auth.current()?.token ?? null, this.options.fetcher);
    } catch {
      this.options.toaster.show("Something went wrong. Try again.");
      return;
    }
    if (isProblem(response)) {
      this.handleProblem(response);
      return;
    }
    this.options.toaster.show(done);
    return this.load();
  }

  // Follows a link on the page, as a user's click does.
  follow(link: Link): Promise<void> {
    return this.invokeIn(this.page, link, "POST");
  }

  private async invokeIn(frame: Frame, link: Link, method: Method): Promise<void> {
    let service: string;
    try {
      [service] = featureOf(link);
    } catch (error) {
      this.options.toaster.show(String((error as Error).message));
      return;
    }
    const config = this.options.config.services[service];
    const module = await this.moduleOf(service);
    if (!config || !module) {
      this.options.toaster.show(`There's no service called ${service}.`);
      return;
    }

    let response: ShellResponse;
    try {
      response = await invoke(config.bff, link, method, this.options.auth.current()?.token ?? null, this.options.fetcher);
    } catch {
      this.options.toaster.show("Something went wrong. Try again.");
      return;
    }
    if (isProblem(response)) {
      this.handleProblem(response);
      return;
    }

    frame.onResult?.(response);
    // A query moves the page to its address, the module's or else the shell's default one, so a reload
    // or Back invokes it again. A command has no address, so its result is shown without changing the URL.
    if (frame.page && method === "POST") {
      const address = module.linkToAddress(link) ?? (response.family === "query" ? defaultAddressOf(link) : null);
      if (address !== null)
        this.window.history.pushState(null, "", pathOf(service, address));
    }
    this.show(frame, element => (this.customisations.of(service).render ? module.render(element, response, this.hostFor(frame)) : null)
      ?? renderGeneric(element, response.body, this.hostFor(frame), response.feature));
  }

  // Errors are the shell's to handle, and the page stays as it was.
  private handleProblem(response: ShellResponse): void {
    const problem = (typeof response.body === "object" && response.body !== null ? response.body : {}) as Problem;
    const toast = (text: string) => this.options.toaster.show(text);
    if (response.status === 401) {
      toast("Sign in to do that.");
      this.options.needsSignIn?.();
    } else if (response.status === 403) {
      toast("You may not do that.");
    } else if (response.status >= 500) {
      toast("Something went wrong. Try again.");
    } else {
      toast(problem.detail ?? problem.title ?? `The request failed (${response.status}).`);
    }
  }

  private show(frame: Frame, render: (element: HTMLElement) => () => void): void {
    frame.clear?.();
    frame.element.replaceChildren();
    frame.clear = render(frame.element);
  }

  private hostFor(frame: Frame): Host {
    return {
      follow: link => void this.invokeIn(frame, link, "POST"),
      toast: text => this.options.toaster.show(text),
      embed: (element, link, onResult) => {
        const embedded: Frame = { element, page: false, onResult };
        void this.invokeIn(embedded, link, "POST");
        return () => {
          embedded.clear?.();
          element.replaceChildren();
        };
      }
    };
  }

  private moduleOf(service: string): Promise<ServiceModule | null> {
    const config = this.options.config.services[service];
    if (!config)
      return Promise.resolve(null);

    let module = this.modules.get(service);
    if (!module) {
      const importModule = this.options.importModule ?? (url => import(/* @vite-ignore */ url));
      module = importModule(new URL(config.module, this.window.location.href).href).then(m => m.default);
      this.modules.set(service, module);
    }
    return module;
  }
}

function message(element: HTMLElement, text: string): () => void {
  const paragraph = element.ownerDocument.createElement("p");
  paragraph.className = "fw-message";
  paragraph.textContent = text;
  element.replaceChildren(paragraph);
  return () => element.replaceChildren();
}
