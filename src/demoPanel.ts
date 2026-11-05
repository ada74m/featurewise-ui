import type { Place } from "./address.js";
import type { Auth } from "./auth.js";
import { labelOf, type DemoConfig, type Persona } from "./config.js";
import type { Link } from "./contract.js";

// Above a demo's pages: what the demo is, the story its data tells so far, what to try, who the visitor
// is with a button for each of the demo's other personas, and a button that starts the demo again. A
// persona named in the text to try is a button too. The demo is the first part of the address within
// its service, such as lost-property in /demos/lost-property/unclaimed-items. Anywhere else, the panel
// is hidden. The story and what to try can be folded away, and stay as the visitor left them.
export function renderDemoPanel(
  element: HTMLElement,
  demos: DemoConfig[],
  auth: Auth,
  place: Place,
  reset: (link: Link) => void,
  storage: Storage = localStorage
): void {
  const id = place.kind === "service" ? place.address.split(/[/?]/)[0] : undefined;
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
      title.append(make("span", "fw-demo-chapter", ` · Chapter ${demo.chapter}`));
    parts.push(title);
  }
  for (const paragraph of demo.about ?? [])
    parts.push(make("p", "fw-demo-about", paragraph));

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
  if (demo.storySoFar?.length)
    parts.push(fold("story", "The story so far", demo.storySoFar, false));
  if (demo.tryThis?.length)
    parts.push(fold("try", "Try this", demo.tryThis, true));

  const who = make("div", "fw-demo-who");
  if (personas.length) {
    who.append(make("span", undefined, current ? `You're the ${labelOf(current)}.` : "Try this as"));
    for (const persona of personas.filter(persona => persona !== current)) {
      const button = make("button", "fw-persona", current ? `Switch to ${labelOf(persona)}` : labelOf(persona));
      button.addEventListener("click", () => auth.signInAs(persona));
      who.append(button);
    }
  }
  if (demo.reset && auth.current()) {
    const button = make("button", "fw-demo-reset", "Reset this demo");
    button.title = "Forget what's been done here, and start the story again";
    button.addEventListener("click", () => reset(demo.reset!));
    who.append(button);
  }
  if (who.childNodes.length)
    parts.push(who);

  element.replaceChildren(...parts);
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
