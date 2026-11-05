import { isLink, type Host, type Link } from "./contract.js";
import { openLinkDialog } from "./linkDialog.js";

// Renders any result as nested lists, each property named as "Name: value". A link's value is an "open"
// button, so LinkToDelete reads "LinkToDelete: open", and opens the link's JSON to edit and follow. It
// knows nothing about any feature, so every service can be used before it has handlers of its own.
export function renderGeneric(element: HTMLElement, value: unknown, host: Host): () => void {
  const document = element.ownerDocument;
  const root = document.createElement("div");
  root.className = "fw-generic";
  root.append(node(document, value, "link", host));
  element.replaceChildren(root);
  return () => element.replaceChildren();
}

function node(document: Document, value: unknown, label: string, host: Host): Node {
  if (value === null || value === undefined)
    return text(document, "null", "fw-null");
  if (typeof value === "boolean")
    return text(document, value ? "yes" : "no");
  if (typeof value !== "object")
    return text(document, String(value));
  if (isLink(value))
    return linkButton(document, label, value, host);

  const list = document.createElement("ul");
  const entries: [string, unknown][] = Array.isArray(value)
    ? value.map((item, index) => [String(index), item])
    : Object.entries(value);
  for (const [key, item] of entries) {
    const entry = document.createElement("li");
    if (!Array.isArray(value)) {
      const name = document.createElement("span");
      name.className = "fw-key";
      name.textContent = `${key}: `;
      entry.append(name);
    }
    entry.append(node(document, item, Array.isArray(value) ? label : key, host));
    list.append(entry);
  }
  return list;
}

function linkButton(document: Document, label: string, link: Link, host: Host): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "fw-link";
  button.textContent = "open";
  // Which link it is, for a screen reader and on hover.
  button.setAttribute("aria-label", `Open ${label}`);
  button.title = link.$feature;
  button.addEventListener("click", () => openLinkDialog(document, label, link, host.follow));
  return button;
}

function text(document: Document, content: string, className?: string): HTMLSpanElement {
  const span = document.createElement("span");
  span.textContent = content;
  if (className)
    span.className = className;
  return span;
}
