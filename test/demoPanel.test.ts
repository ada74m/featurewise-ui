import { beforeEach, describe, expect, it } from "vitest";
import { devAuth } from "../src/auth.js";
import type { DemoConfig } from "../src/config.js";
import type { Link } from "../src/contract.js";
import { renderDemoPanel } from "../src/demoPanel.js";

describe("the demo panel", () => {
  const reset: Link = { $feature: "demos/ResetDemo", Demo: "lost-property" };
  const demos: DemoConfig[] = [{
    id: "lost-property",
    title: "The lost property office",
    chapter: "1. Features",
    about: ["A railway station's lost property office."],
    storySoFar: ["Six things are waiting to be claimed."],
    tryThis: ["As the clerk, hand in an umbrella.", "Then, as the Traveller, claim it."],
    reset
  }];
  const personas = [
    { id: "traveller", label: "Traveller", demo: "lost-property" },
    { id: "clerk", label: "Clerk", demo: "lost-property", groups: ["clerk"] },
    { id: "theatregoer", label: "Theatregoer", demo: "box-office" }
  ];
  const lostProperty = { kind: "service", service: "demos", address: "lost-property/unclaimed-items" } as const;
  let panel: HTMLElement;
  let resets: Link[];

  beforeEach(() => {
    localStorage.clear();
    panel = document.createElement("section");
    resets = [];
  });

  const render = (auth = devAuth(personas), place: Parameters<typeof renderDemoPanel>[3] = lostProperty) =>
    renderDemoPanel(panel, demos, auth, place, link => resets.push(link));
  const switches = () => [...panel.querySelectorAll("button.fw-persona")].map(button => button.textContent);

  it("says what the demo is, and the story so far", () => {
    render();

    expect(panel.hidden).toBe(false);
    expect(panel.querySelector(".fw-demo-title")!.textContent).toBe("The lost property office · Chapter 1. Features");
    expect(panel.textContent).toContain("A railway station's lost property office.");
    expect(panel.textContent).toContain("Six things are waiting to be claimed.");
  });

  it("makes each persona the text names a button that becomes them", () => {
    const auth = devAuth(personas);
    render(auth);

    const named = [...panel.querySelectorAll("button.fw-persona-name")];
    expect(named.map(button => button.textContent)).toEqual(["clerk", "Traveller"]);
    (named[0] as HTMLButtonElement).click();
    expect(auth.current()?.username).toBe("clerk");
  });

  it("offers the demo's personas to someone who isn't one yet, and nobody else's", () => {
    render();

    expect(panel.textContent).toContain("Try this as");
    expect(switches()).toEqual(["Traveller", "Clerk"]);
  });

  it("says who the visitor is, and switches to another of the demo's personas", () => {
    const auth = devAuth(personas);
    auth.signInAs(personas[0]!);
    render(auth);

    expect(panel.textContent).toContain("You're the Traveller.");
    expect(switches()).toEqual(["Switch to Clerk"]);
    (panel.querySelector("button.fw-persona") as HTMLButtonElement).click();
    expect(auth.current()?.username).toBe("clerk");
  });

  it("starts the demo again, for someone signed in", () => {
    render();
    expect(panel.querySelector(".fw-demo-reset")).toBeNull();

    const auth = devAuth(personas);
    auth.signInAs(personas[1]!);
    render(auth);
    (panel.querySelector(".fw-demo-reset") as HTMLButtonElement).click();

    expect(resets).toEqual([reset]);
  });

  it("keeps the story folded once it's folded", () => {
    render();
    const story = panel.querySelector("details")!;
    story.open = false;
    story.dispatchEvent(new Event("toggle"));

    render();

    expect(panel.querySelector("details")!.open).toBe(false);
  });

  it("hides where the page has no demo", () => {
    render(devAuth(personas), { kind: "service", service: "sample", address: "things" });
    expect(panel.hidden).toBe(true);

    render(devAuth(personas), { kind: "shell", page: "services" });
    expect(panel.hidden).toBe(true);
  });
});
