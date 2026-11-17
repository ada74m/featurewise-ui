import { pathOf, type Place } from "./address.js";
import type { DemoConfig, ShellConfig } from "./config.js";

// Where services.json lists demos, the shell is their site: a bar across the top with the site's title,
// which leads home, and a link to each demo; a home page at "/" listing them; and each demo's text in a
// sidebar beside its pages (src/demoPanel.ts). A demo's link leads to its service's own path, which its
// module takes to its first page.

export function renderDemoBar(bar: HTMLElement, config: ShellConfig, place: Place): void {
  const document = bar.ownerDocument;
  const home = document.createElement("a");
  home.className = "fw-bar-title";
  home.href = "/";
  home.textContent = config.title ?? "Featurewise";
  if (place.kind === "default")
    home.setAttribute("aria-current", "page");

  const nav = document.createElement("nav");
  for (const demo of config.demos ?? []) {
    const link = document.createElement("a");
    link.href = pathOf(demo.id, "");
    link.textContent = demo.title ?? demo.id;
    if (place.kind === "service" && place.service === demo.id)
      link.setAttribute("aria-current", "page");
    nav.append(link);
  }
  bar.replaceChildren(home, nav);
}

// The home page: each demo, with its chapter and what it's about.
export function renderDemoHome(element: HTMLElement, title: string | undefined, demos: DemoConfig[]): () => void {
  const document = element.ownerDocument;
  const page = document.createElement("section");
  page.className = "fw-home";

  const heading = document.createElement("h1");
  heading.textContent = title ?? "Featurewise";
  const cards = document.createElement("div");
  cards.className = "fw-grid";
  for (const demo of demos) {
    const card = document.createElement("article");
    card.className = "fw-home-card";
    const name = document.createElement("h2");
    const link = document.createElement("a");
    link.href = pathOf(demo.id, "");
    link.textContent = demo.title ?? demo.id;
    name.append(link);
    card.append(name);
    if (demo.chapter) {
      const chapter = document.createElement("p");
      chapter.className = "fw-home-chapter";
      chapter.textContent = `Chapter ${demo.chapter}`;
      card.append(chapter);
    }
    if (demo.about?.[0]) {
      const about = document.createElement("p");
      about.textContent = demo.about[0];
      card.append(about);
    }
    cards.append(card);
  }
  page.append(heading, cards);
  element.replaceChildren(page);
  return () => element.replaceChildren();
}
