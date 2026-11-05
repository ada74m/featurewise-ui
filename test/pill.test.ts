import { beforeEach, describe, expect, it } from "vitest";
import { devAuth } from "../src/auth.js";
import { definePill, type Pill } from "../src/pill.js";

describe("the pill", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    localStorage.clear();
    definePill();
  });

  function pill(openSettings = () => {}) {
    const auth = devAuth([{ id: "ann", groups: ["editor"] }, { id: "bob" }]);
    const element = document.createElement("featurewise-pill") as Pill;
    document.body.append(element);
    element.attach(auth, openSettings);
    const buttons = () => [...element.shadowRoot!.querySelectorAll("button")];
    return { auth, element, buttons };
  }

  it("offers to sign in until someone is, then shows who", () => {
    const { auth, buttons } = pill();
    expect(buttons().map(b => b.textContent)).toContain("Sign in");

    buttons().find(b => b.textContent === "ann (editor)")!.click();

    expect(auth.current()?.username).toBe("ann");
    expect(buttons().map(b => b.textContent)).toContain("ann");
    expect(buttons().map(b => b.textContent)).toContain("Log out");
  });

  it("logs out", () => {
    const { auth, buttons } = pill();
    auth.signInAs({ id: "bob" });

    buttons().find(b => b.textContent === "Log out")!.click();

    expect(auth.current()).toBeNull();
  });

  it("opens the services page from its cog", () => {
    let opened = false;
    const { buttons } = pill(() => { opened = true; });

    buttons().find(b => b.title === "Services")!.click();

    expect(opened).toBe(true);
  });

  it("goes straight to the provider to sign in, where sign-in is real", () => {
    const wentFrom: string[] = [];
    const auth = { ...devAuth([]), signIn: async (returnTo: string) => { wentFrom.push(returnTo); } };
    history.replaceState(null, "", "/sample/things");
    const element = document.createElement("featurewise-pill") as Pill;
    document.body.append(element);
    element.attach(auth, () => {});

    [...element.shadowRoot!.querySelectorAll("button")].find(b => b.textContent === "Sign in")!.click();

    expect(wentFrom).toEqual(["/sample/things"]);
  });

  it("keeps its styles in its shadow root", () => {
    const { element } = pill();

    expect(element.shadowRoot!.querySelector("style")).not.toBeNull();
    expect(document.head.querySelector("style")).toBeNull();
  });
});
