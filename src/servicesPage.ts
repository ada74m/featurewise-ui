import type { ShellConfig } from "./config.js";

// The shell's page listing the services it can reach, with each one's UI backend, which is most useful
// outside production, to see which backends an environment points at.
export function renderServicesPage(element: HTMLElement, config: ShellConfig, base: string): () => void {
  const document = element.ownerDocument;
  const page = document.createElement("section");
  page.className = "fw-services";

  const heading = document.createElement("h1");
  heading.textContent = "Services";

  const table = document.createElement("table");
  const head = table.createTHead().insertRow();
  for (const title of ["Service", "Backend"]) {
    const cell = document.createElement("th");
    cell.textContent = title;
    head.append(cell);
  }
  const body = table.createTBody();
  for (const [id, service] of Object.entries(config.services)) {
    const row = body.insertRow();
    row.insertCell().textContent = id;
    row.insertCell().textContent = new URL(service.bff, base).href;
  }

  page.append(heading, table);
  element.replaceChildren(page);
  return () => element.replaceChildren();
}
