import type { ShellConfig } from "./config.js";
import type { Customisations } from "./customisation.js";

// The shell's page listing the services it can reach, with each one's UI backend, which is most useful
// outside production, to see which backends an environment points at. It also turns each module's
// rendering on and off, to see the service as the generic shell shows it.
export function renderServicesPage(element: HTMLElement, config: ShellConfig, base: string, customisations: Customisations): () => void {
  const document = element.ownerDocument;
  const page = document.createElement("section");
  page.className = "fw-services";

  const heading = document.createElement("h1");
  heading.textContent = "Services";

  const explanation = document.createElement("p");
  explanation.textContent = "Turn off a module's rendering to see the service as the generic shell shows it.";

  const table = document.createElement("table");
  const head = table.createTHead().insertRow();
  for (const title of ["Service", "Backend", "Module's rendering"]) {
    const cell = document.createElement("th");
    cell.textContent = title;
    head.append(cell);
  }
  const body = table.createTBody();
  for (const [id, service] of Object.entries(config.services)) {
    const row = body.insertRow();
    row.insertCell().textContent = id;
    row.insertCell().textContent = new URL(service.bff, base).href;
    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.name = `${id}-render`;
    toggle.checked = customisations.of(id).render;
    toggle.addEventListener("change", () => customisations.set(id, { render: toggle.checked }));
    row.insertCell().append(toggle);
  }

  page.append(heading, explanation, table);
  element.replaceChildren(page);
  return () => element.replaceChildren();
}
