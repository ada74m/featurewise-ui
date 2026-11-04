import type { Auth } from "./auth.js";

// The shell's own controls: who's signed in, with a menu to switch user or log out, and a cog that
// opens the services page. It floats in the top right corner until dragged, and remembers where it was
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
  hr { border: none; border-top: 1px solid var(--fw-border, #ddd); margin: 4px 0; }
`;

export class Pill extends HTMLElement {
  private auth: Auth | null = null;
  private openSettings: () => void = () => {};
  private readonly root: ShadowRoot;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });
  }

  attach(auth: Auth, openSettings: () => void): void {
    this.auth = auth;
    this.openSettings = openSettings;
    auth.onChange(() => this.renderPill());
    this.renderPill();
    this.restorePosition();
    window.addEventListener("resize", () => this.keepOnScreen());
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

    const who = document.createElement("button");
    who.textContent = user ? user.username : "Sign in";
    who.setAttribute("popovertarget", "menu");

    const cog = document.createElement("button");
    cog.textContent = "⚙";
    cog.title = "Services";
    cog.setAttribute("aria-label", "Services");
    cog.addEventListener("click", () => this.openSettings());

    const menu = document.createElement("div");
    menu.id = "menu";
    menu.setAttribute("popover", "");
    for (const devUser of auth.users()) {
      const item = document.createElement("button");
      item.textContent = devUser.groups?.length ? `${devUser.username} (${devUser.groups.join(", ")})` : devUser.username;
      if (devUser.username === user?.username)
        item.className = "current";
      item.addEventListener("click", () => auth.signInAs(devUser));
      menu.append(item);
    }
    if (user) {
      if (auth.users().length)
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
