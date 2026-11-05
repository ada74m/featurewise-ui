import type { Place } from "./address.js";
import type { Auth } from "./auth.js";
import { labelOf, type Persona } from "./config.js";

// Above a demo's pages: who the visitor is, and a button for each of the demo's other personas, so a
// visitor can see the same page as someone else in one click. The demo is the first part of the address
// within its service, such as lost-property in /demos/lost-property/unclaimed-items. Anywhere without
// personas of its own, the bar is hidden.
export function renderPersonaBar(element: HTMLElement, auth: Auth, place: Place): void {
  const demo = place.kind === "service" ? place.address.split(/[/?]/)[0] : undefined;
  const personas = demo ? auth.personas().filter(persona => persona.demo === demo) : [];
  element.hidden = personas.length === 0;
  if (element.hidden) {
    element.replaceChildren();
    return;
  }

  const document = element.ownerDocument;
  const current = personas.find(persona => persona.id === auth.current()?.username);
  const intro = document.createElement("span");
  intro.textContent = current ? `You're the ${labelOf(current)}.` : "Try this as";
  const buttons = personas
    .filter(persona => persona !== current)
    .map((persona: Persona) => {
      const button = document.createElement("button");
      button.className = "fw-persona";
      button.textContent = current ? `Switch to ${labelOf(persona)}` : labelOf(persona);
      button.addEventListener("click", () => auth.signInAs(persona));
      return button;
    });
  element.replaceChildren(intro, ...buttons);
}
