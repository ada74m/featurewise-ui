import { beforeEach, describe, expect, it } from "vitest";
import { devAuth } from "../src/auth.js";
import { renderPersonaBar } from "../src/personaBar.js";

describe("the persona bar", () => {
  const personas = [
    { id: "traveller", label: "Traveller", demo: "lost-property" },
    { id: "clerk", label: "Clerk", demo: "lost-property", groups: ["clerk"] },
    { id: "theatregoer", label: "Theatregoer", demo: "box-office" }
  ];
  let bar: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    bar = document.createElement("div");
  });

  const lostProperty = { kind: "service", service: "demos", address: "lost-property/unclaimed-items" } as const;
  const buttons = () => [...bar.querySelectorAll("button")].map(button => button.textContent);

  it("offers the demo's personas to someone who isn't one yet", () => {
    renderPersonaBar(bar, devAuth(personas), lostProperty);

    expect(bar.hidden).toBe(false);
    expect(bar.textContent).toContain("Try this as");
    expect(buttons()).toEqual(["Traveller", "Clerk"]);
  });

  it("says who the visitor is, and switches to another of the demo's personas", () => {
    const auth = devAuth(personas);
    auth.signInAs(personas[0]!);
    renderPersonaBar(bar, auth, lostProperty);

    expect(bar.textContent).toContain("You're the Traveller.");
    expect(buttons()).toEqual(["Switch to Clerk"]);

    bar.querySelector("button")!.click();
    expect(auth.current()?.username).toBe("clerk");
  });

  it("hides where the page has no personas of its own", () => {
    renderPersonaBar(bar, devAuth(personas), { kind: "service", service: "sample", address: "things" });
    expect(bar.hidden).toBe(true);

    renderPersonaBar(bar, devAuth(personas), { kind: "shell", page: "services" });
    expect(bar.hidden).toBe(true);
  });
});
