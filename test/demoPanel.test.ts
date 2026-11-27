import { beforeEach, describe, expect, it } from "vitest";
import { devAuth } from "../src/auth.js";
import type { DemoConfig } from "../src/config.js";
import type { Link } from "../src/contract.js";
import { renderDemoPanel, type View } from "../src/demoPanel.js";

describe("the demo panel", () => {
  const reset: Link = { $command: "demos/ResetDemo", Demo: "lost-property" };
  const demos: DemoConfig[] = [{
    id: "lost-property",
    title: "The lost property office",
    topic: "Features",
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
  const lostProperty = { kind: "service", service: "lost-property", address: "unclaimed-items" } as const;
  let panel: HTMLElement;
  let resets: Link[];

  beforeEach(() => {
    localStorage.clear();
    panel = document.createElement("section");
    resets = [];
  });

  const render = (auth = devAuth(personas), place: Parameters<typeof renderDemoPanel>[3] = lostProperty, view?: View) =>
    renderDemoPanel(panel, demos, auth, place, link => resets.push(link), view);
  // The persona buttons' labels, the chosen one marked with a star.
  const switches = () => [...panel.querySelectorAll(".fw-demo-as button")]
    .map(button => `${button.textContent}${button.getAttribute("aria-pressed") === "true" ? "*" : ""}`);

  it("says what the demo is, and the story so far", () => {
    render();

    expect(panel.hidden).toBe(false);
    expect(panel.querySelector(".fw-demo-title strong")!.textContent).toBe("The lost property office");
    expect(panel.querySelector(".fw-demo-topic")!.textContent).toBe("Features");
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

  it("is the demo whose service the page belongs to, whatever the address and whoever is signed in", () => {
    const auth = devAuth(personas);
    auth.signInAs(personas[2]!);

    render(auth, { kind: "service", service: "lost-property", address: "_/ItemsFoundAt" });

    expect(panel.hidden).toBe(false);
    expect(panel.querySelector(".fw-demo-title")!.textContent).toContain("The lost property office");
  });

  it("shows for a visitor who isn't signed in yet", () => {
    render(devAuth(personas), { kind: "service", service: "lost-property", address: "_/DonatedToCharity" });

    expect(panel.hidden).toBe(false);
  });

  it("is hidden on the shell's own pages, even for a persona", () => {
    const auth = devAuth(personas);
    auth.signInAs(personas[1]!);

    render(auth, { kind: "shell", page: "services" });

    expect(panel.hidden).toBe(true);
  });

  it("offers the demo's personas to someone who isn't one yet, and nobody else's", () => {
    render();

    expect(switches()).toEqual(["Traveller", "Clerk"]);
  });

  it("says who the visitor is, and switches to another of the demo's personas", () => {
    const auth = devAuth(personas);
    auth.signInAs(personas[0]!);
    render(auth);

    expect(switches()).toEqual(["Traveller*", "Clerk"]);
    const [traveller, clerk] = [...panel.querySelectorAll<HTMLButtonElement>(".fw-demo-as button")];
    traveller!.click();
    expect(auth.current()?.username).toBe("traveller");
    clerk!.click();
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

  it("says whether the pages are plain or dressed, and changes it", () => {
    const chosen: boolean[] = [];
    render(devAuth(personas), lostProperty, { dressed: true, choose: dressed => chosen.push(dressed) });
    const [plain, dressed] = [...panel.querySelectorAll<HTMLButtonElement>(".fw-demo-view button")];

    expect([plain!.getAttribute("aria-pressed"), dressed!.getAttribute("aria-pressed")]).toEqual(["false", "true"]);
    dressed!.click();
    plain!.click();
    expect(chosen).toEqual([false]);
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
