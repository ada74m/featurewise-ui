import { beforeEach, describe, expect, it } from "vitest";
import type { ShellConfig } from "../src/config.js";
import { renderDemoBar, renderDemoHome } from "../src/demoSite.js";

describe("the demos' site", () => {
  const config: ShellConfig = {
    default: "/lost-property/unclaimed-items",
    title: "Featurewise demos",
    services: {},
    demos: [
      { id: "lost-property", title: "The lost property office", topic: "Links", about: ["A railway station's lost property office.", "More."] },
      { id: "box-office", title: "The box office" }
    ]
  };
  let element: HTMLElement;

  beforeEach(() => {
    element = document.createElement("div");
  });

  const links = () => [...element.querySelectorAll("a")].map(a => [a.textContent, a.getAttribute("href"), a.getAttribute("aria-current")]);

  it("has a bar with the site's title, leading home, and a link to each demo, marking the one showing", () => {
    renderDemoBar(element, config, { kind: "service", service: "box-office", address: "shows" });

    expect(links()).toEqual([
      ["Featurewise demos", "/", null],
      ["The lost property office", "/lost-property/", null],
      ["The box office", "/box-office/", "page"]
    ]);
    expect(element.querySelector(".fw-bar-title img")!.getAttribute("src")).toBe("/logo.svg");
  });

  it("marks home in the bar on the home page", () => {
    renderDemoBar(element, config, { kind: "default" });
    expect(links()[0]![2]).toBe("page");
  });

  it("lists each demo on the home page, with its topic and what it's about", () => {
    renderDemoHome(element, config.title, config.demos!);

    expect(element.querySelector("h1")!.textContent).toBe("Featurewise demos");
    const cards = [...element.querySelectorAll(".fw-home-card")];
    expect(cards).toHaveLength(2);
    expect(cards[0]!.textContent).toBe("The lost property officeLinksA railway station's lost property office.");
    expect(links().map(([text, href]) => [text, href])).toEqual([
      ["The lost property office", "/lost-property/"],
      ["The box office", "/box-office/"]
    ]);
  });
});
