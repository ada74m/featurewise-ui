import { isLink, type Host, type Link } from "./contract.js";
import { openLinkDialog } from "./linkDialog.js";

// Renders any result as formatted JSON does, nested in braces and brackets, with each property named as
// "Name: value" but without JSON's quotes and commas. A link is the one thing JSON doesn't show: its
// value is an "open" button, so LinkToDelete reads "LinkToDelete: open", and opens the link's JSON to
// edit and follow. It knows nothing about any feature, so every service can be used before it has
// handlers of its own.
export function renderGeneric(element: HTMLElement, value: unknown, host: Host): () => void {
  const document = element.ownerDocument;
  const root = document.createElement("div");
  root.className = "fw-generic";
  root.append(...node(document, value, "link", host));
  element.replaceChildren(root);
  return () => element.replaceChildren();
}

// What follows a property's name: a value on its line, or an opening brace or bracket there, the
// members indented beneath it, and the closing one on a line of its own.
function node(document: Document, value: unknown, label: string, host: Host): Node[] {
  if (value === null || value === undefined)
    return [text(document, "null", "fw-null")];
  if (typeof value === "boolean")
    return [text(document, value ? "yes" : "no")];
  if (typeof value !== "object")
    return [text(document, String(value))];
  if (isLink(value))
    return [linkButton(document, label, value, host)];

  const array = Array.isArray(value);
  const [open, close] = array ? ["[", "]"] : ["{", "}"];
  const entries: [string, unknown][] = array ? value.map((item, index) => [String(index), item]) : Object.entries(value);
  if (entries.length === 0)
    return [text(document, open + close, "fw-punct")];

  const list = document.createElement("ul");
  for (const [key, item] of entries) {
    const entry = document.createElement("li");
    // An array's members are told apart by their braces, not by numbers.
    if (!array)
      entry.append(text(document, `${key}: `, "fw-key"));
    entry.append(...node(document, item, array ? label : key, host));
    list.append(entry);
  }
  const closing = document.createElement("div");
  closing.className = "fw-punct";
  closing.textContent = close;
  return [text(document, open, "fw-punct"), list, closing];
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
