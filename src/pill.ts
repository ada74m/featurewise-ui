import type { Auth } from "./auth.js";
import { labelOf, type DemoConfig, type Persona } from "./config.js";

// The shell's own controls: who's signed in, with a menu to switch user or log out, and a cog that
// opens the services page. On a demo's pages, the menu offers that demo's personas; elsewhere, every
// persona, under its demo's title. It floats in the top right corner until dragged, and remembers where it was
// put. Its styles live in its shadow root, so a module's styles don't reach it and its don't reach
// modules; the shell's custom properties, such as --fw-accent, still do.

const positionKey = "featurewise.pill";

const styles = `
  :host { position: fixed; top: 12px; right: 12px; z-index: 1000; font: var(--fw-font, 14px system-ui, sans-serif); }
  .pill { display: flex; align-items: center; gap: 4px; padding: 4px 6px; border-radius: 999px;
          background: var(--fw-surface, #fff); color: var(--fw-text, #222);
          box-shadow: 0 1px 4px rgba(0, 0, 0, .25); user-select: none; }
  .grip { cursor: grab; padding: 0 4px; color: var(--fw-muted, #888); touch-action: none; }
  button { font: inherit; border: none; background: none; color: inherit; cursor: pointer; padding: 2px 8px; border-radius: 999px; }
  button:hover { background: var(--fw-hover, rgba(0, 0, 0, .06)); }
  [popover] { position: fixed; inset: auto; margin: 0; padding: 4px; border: none; border-radius: 8px; background: var(--fw-surface, #fff);
              color: var(--fw-text, #222); box-shadow: 0 2px 8px rgba(0, 0, 0, .25); font: inherit; }
  [popover] button { display: block; width: 100%; text-align: left; border-radius: 4px; }
  .current { font-weight: 600; }
  .demo { padding: 4px 8px 2px; color: var(--fw-muted, #888); font-size: .85em; }
  hr { border: none; border-top: 1px solid var(--fw-border, #ddd); margin: 4px 0; }
`;

export class Pill extends HTMLElement {
  private auth: Auth | null = null;
  private openSettings: () => void = () => {};
  private demos: DemoConfig[] = [];
  // The demo whose page is showing, the service's id, if the page is a service's.
  private demo: string | undefined;
  private readonly root: ShadowRoot;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });
  }

  attach(auth: Auth, openSettings: () => void, demos: DemoConfig[] = []): void {
    this.auth = auth;
    this.openSettings = openSettings;
    this.demos = demos;
    auth.onChange(() => this.renderPill());
    this.renderPill();
    this.restorePosition();
    window.addEventListener("resize", () => this.keepOnScreen());
  }

  // Says which service's page is showing, which is the demo of the same id, if there is one.
  showingService(service: string | undefined): void {
    if (service === this.demo)
      return;
    this.demo = service;
    this.renderPill();
  }

  // Opens the user menu, as when a request needs someone signed in.
  openMenu(): void {
    (this.root.getElementById("menu") as HTMLElement & { showPopover?: () => void } | null)?.showPopover?.();
  }

  private renderPill(): void {
    const auth = this.auth;
    if (!auth)
      return;
    const user = auth.current();

    const style = document.createElement("style");
    style.textContent = styles;

    const pill = document.createElement("div");
    pill.className = "pill";

    const grip = document.createElement("span");
    grip.className = "grip";
    grip.textContent = "⋮⋮";
    grip.title = "Drag to move";
    this.dragBy(grip);

    const current = auth.personas().find(persona => persona.id === user?.username);
    const who = document.createElement("button");
    who.textContent = user ? (current ? labelOf(current) : user.username) : "Sign in";
    // With a real sign-in and no personas, Sign in goes straight to the provider; otherwise it opens the
    // menu of personas.
    if (!user && auth.signIn && auth.personas().length === 0)
      who.addEventListener("click", () => void auth.signIn!(location.pathname + location.search));
    else
      who.setAttribute("popovertarget", "menu");

    const cog = document.createElement("button");
    cog.textContent = "⚙";
    cog.title = "Services";
    cog.setAttribute("aria-label", "Services");
    cog.addEventListener("click", () => this.openSettings());

    const menu = document.createElement("div");
    menu.id = "menu";
    menu.setAttribute("popover", "");
    const item = (persona: Persona) => {
      const button = document.createElement("button");
      button.textContent = persona.groups?.length ? `${labelOf(persona)} (${persona.groups.join(", ")})` : labelOf(persona);
      if (persona.id === user?.username)
        button.className = "current";
      button.addEventListener("click", () => auth.signInAs(persona));
      return button;
    };
    const ofThisDemo = auth.personas().filter(persona => persona.demo !== undefined && persona.demo === this.demo);
    if (ofThisDemo.length)
      menu.append(...ofThisDemo.map(item));
    else {
      // Every persona, each demo's under its title, as they come.
      let heading: string | undefined;
      for (const persona of auth.personas()) {
        if (persona.demo !== undefined && persona.demo !== heading) {
          heading = persona.demo;
          const title = document.createElement("div");
          title.className = "demo";
          title.textContent = this.demos.find(demo => demo.id === heading)?.title ?? heading;
          menu.append(title);
        }
        menu.append(item(persona));
      }
    }
    if (user) {
      if (auth.personas().length)
        menu.append(document.createElement("hr"));
      const logOut = document.createElement("button");
      logOut.textContent = "Log out";
      logOut.addEventListener("click", () => auth.signOut());
      menu.append(logOut);
    }

    // A popover is placed on its own, so put it by the pill each time it opens.
    menu.addEventListener("toggle", event => {
      if ((event as ToggleEvent).newState === "open")
        this.placeMenu(menu);
    });

    pill.append(grip, who, cog, menu);
    this.root.replaceChildren(style, pill);
  }

  // Below the pill and lined up with its right edge, or above it when there's no room below, and always
  // on screen.
  private placeMenu(menu: HTMLElement): void {
    const pill = this.getBoundingClientRect();
    const gap = 6;
    const left = Math.min(Math.max(gap, pill.right - menu.offsetWidth), window.innerWidth - menu.offsetWidth - gap);
    const below = pill.bottom + gap;
    const top = below + menu.offsetHeight <= window.innerHeight ? below : Math.max(gap, pill.top - menu.offsetHeight - gap);
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }

  private dragBy(grip: HTMLElement): void {
    grip.addEventListener("pointerdown", down => {
      const start = this.getBoundingClientRect();
      const offsetX = down.clientX - start.left;
      const offsetY = down.clientY - start.top;
      grip.setPointerCapture(down.pointerId);

      const move = (event: PointerEvent) => this.moveTo(event.clientX - offsetX, event.clientY - offsetY);
      const up = () => {
        grip.removeEventListener("pointermove", move);
        grip.removeEventListener("pointerup", up);
        const { left, top } = this.getBoundingClientRect();
        localStorage.setItem(positionKey, JSON.stringify({ left, top }));
      };
      grip.addEventListener("pointermove", move);
      grip.addEventListener("pointerup", up);
    });
  }

  private moveTo(left: number, top: number): void {
    const maxLeft = Math.max(0, window.innerWidth - this.offsetWidth);
    const maxTop = Math.max(0, window.innerHeight - this.offsetHeight);
    this.style.left = `${Math.min(Math.max(0, left), maxLeft)}px`;
    this.style.top = `${Math.min(Math.max(0, top), maxTop)}px`;
    this.style.right = "auto";
  }

  private restorePosition(): void {
    try {
      const saved = JSON.parse(localStorage.getItem(positionKey) ?? "null");
      if (typeof saved?.left === "number" && typeof saved?.top === "number")
        this.moveTo(saved.left, saved.top);
    } catch {
      localStorage.removeItem(positionKey);
    }
  }

  // Pulls the pill back on screen when the window shrinks under it.
  private keepOnScreen(): void {
    if (this.style.left)
      this.moveTo(parseFloat(this.style.left), parseFloat(this.style.top));
  }
}

export function definePill(): void {
  if (!customElements.get("featurewise-pill"))
    customElements.define("featurewise-pill", Pill);
}
