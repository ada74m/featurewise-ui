import type { Place } from "./address.js";
import type { Auth } from "./auth.js";
import { labelOf, type DemoConfig, type Persona } from "./config.js";
import type { Link } from "./contract.js";

// Beside a demo's pages: what the demo is, the story its data tells so far, what to try, who the visitor
// is with a button for each of the demo's other personas, whether its pages are shown plain or dressed,
// and a button that starts the demo again. A
// persona named in the text to try is a button too. Each demo is a service of its own, so the demo is
// the service whose page it is, such as lost-property on /lost-property/unclaimed-items, whatever the
// address and whoever is signed in. On another service's pages, and on the shell's own, the panel is
// hidden. The story and what to try can be folded away, and stay as the visitor left them.
export function renderDemoPanel(
  element: HTMLElement,
  demos: DemoConfig[],
  auth: Auth,
  place: Place,
  reset: (link: Link) => void,
  view?: View,
  storage: Storage = localStorage
): void {
  const id = place.kind === "service" ? place.service : undefined;
  const personas = id ? auth.personas().filter(persona => persona.demo === id) : [];
  const demo = demos.find(demo => demo.id === id) ?? (personas.length ? { id: id! } : undefined);
  element.hidden = !demo;
  if (!demo) {
    element.replaceChildren();
    return;
  }

  const document = element.ownerDocument;
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) => {
    const made = document.createElement(tag);
    if (className)
      made.className = className;
    if (text !== undefined)
      made.textContent = text;
    return made;
  };
  const current = personas.find(persona => persona.id === auth.current()?.username);
  const become = (persona: Persona, text: string) => {
    const button = make("button", "fw-persona-name", text);
    button.disabled = persona === current;
    button.title = persona === current ? `You're the ${labelOf(persona)}` : `Become the ${labelOf(persona)}`;
    button.addEventListener("click", () => auth.signInAs(persona));
    return button;
  };

  const parts: Node[] = [];
  if (demo.title) {
    const title = make("div", "fw-demo-title");
    title.append(make("strong", undefined, demo.title));
    if (demo.chapter)
      title.append(make("span", "fw-demo-chapter", `Chapter ${demo.chapter}`));
    parts.push(title);
  }

  const fold = (key: string, summary: string, items: string[], list: boolean) => {
    const details = make("details", "fw-demo-fold");
    const remembered = `featurewise.demo.${demo.id}.${key}`;
    details.open = storage.getItem(remembered) !== "closed";
    details.addEventListener("toggle", () => storage.setItem(remembered, details.open ? "open" : "closed"));
    details.append(make("summary", undefined, summary));
    const body = list ? make("ol") : make("div");
    for (const item of items) {
      const line = make(list ? "li" : "p");
      line.append(...withPersonas(document, item, personas, become));
      body.append(line);
    }
    details.append(body);
    return details;
  };

  // A row of buttons, one for each option, with the one chosen pressed; choosing it again does nothing.
  const choice = (className: string, label: string, options: { label: string; chosen: boolean; choose: () => void }[]) => {
    const row = make("div", `fw-demo-choice ${className}`);
    row.append(make("span", undefined, label));
    for (const option of options) {
      const button = make("button", undefined, option.label);
      button.setAttribute("aria-pressed", String(option.chosen));
      button.addEventListener("click", () => {
        if (!option.chosen)
          option.choose();
      });
      row.append(button);
    }
    return row;
  };

  // The controls come before the text, so they're in reach however long the text is: who the visitor
  // is, and whether the pages are plain (the shell's generic renderer) or dressed (the module's).
  const controls = make("div", "fw-demo-controls");
  if (personas.length)
    controls.append(choice("fw-demo-as", "As", personas.map(persona =>
      ({ label: labelOf(persona), chosen: persona === current, choose: () => auth.signInAs(persona) }))));
  if (view)
    controls.append(choice("fw-demo-view", "View", [
      { label: "Plain", chosen: !view.dressed, choose: () => view.choose(false) },
      { label: "Dressed", chosen: view.dressed, choose: () => view.choose(true) }
    ]));
  if (demo.reset && auth.current()) {
    const button = make("button", "fw-demo-reset", "Reset this demo");
    button.title = "Forget what's been done here, and start the story again";
    button.addEventListener("click", () => reset(demo.reset!));
    controls.append(button);
  }
  if (controls.childNodes.length)
    parts.push(controls);

  for (const paragraph of demo.about ?? [])
    parts.push(make("p", "fw-demo-about", paragraph));
  if (demo.storySoFar?.length)
    parts.push(fold("story", "The story so far", demo.storySoFar, false));
  if (demo.tryThis?.length)
    parts.push(fold("try", "Try this", demo.tryThis, true));

  element.replaceChildren(...parts);
}

// How the demo's pages are shown, and how to change it.
export interface View {
  dressed: boolean;
  choose(dressed: boolean): void;
}

// The text, with each persona it names, by label or id, as a button that becomes them.
function withPersonas(
  document: Document,
  text: string,
  personas: Persona[],
  become: (persona: Persona, text: string) => HTMLButtonElement
): Node[] {
  const names = new Map<string, Persona>();
  for (const persona of personas)
    for (const name of [labelOf(persona), persona.id])
      names.set(name.toLowerCase(), persona);
  if (names.size === 0)
    return [document.createTextNode(text)];

  const escaped = [...names.keys()].sort((a, b) => b.length - a.length).map(name => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");
  const nodes: Node[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    nodes.push(document.createTextNode(text.slice(last, match.index)));
    nodes.push(become(names.get(match[0].toLowerCase())!, match[0]));
    last = match.index! + match[0].length;
  }
  nodes.push(document.createTextNode(text.slice(last)));
  return nodes;
}
