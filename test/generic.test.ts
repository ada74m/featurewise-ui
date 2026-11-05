import { beforeEach, describe, expect, it } from "vitest";
import type { Host, Link } from "../src/contract.js";
import { renderGeneric } from "../src/generic.js";

describe("the generic renderer", () => {
  let element: HTMLElement;
  let followed: Link[];
  let host: Host;

  beforeEach(() => {
    document.body.replaceChildren();
    element = document.createElement("div");
    document.body.append(element);
    followed = [];
    host = { follow: link => followed.push(link), toast: () => {}, embed: () => () => {} };
  });

  const result = {
    Things: [{
      Thing: { Id: "t1", Name: "Teapot" },
      LinkToDelete: { $feature: "sample/DeleteThing", Id: "t1" },
      LinkToRename: { $feature: "sample/RenameThing", Id: "t1", NewName: null }
    }]
  };

  it("shows every value, and each link as its property's name and an open button", () => {
    renderGeneric(element, result, host);

    expect(element.textContent).toContain("Teapot");
    const entries = [...element.querySelectorAll("li")]
      .filter(entry => entry.querySelector(":scope > button.fw-link"))
      .map(entry => entry.textContent);
    expect(entries).toEqual(["LinkToDelete: open", "LinkToRename: open"]);
    const buttons = [...element.querySelectorAll("button.fw-link")].map(button => button.getAttribute("aria-label"));
    expect(buttons).toEqual(["Open LinkToDelete", "Open LinkToRename"]);
  });

  it("opens a link's JSON to edit, and follows it as edited", () => {
    renderGeneric(element, result, host);
    (element.querySelectorAll("button.fw-link")[1] as HTMLButtonElement).click();

    const dialog = document.querySelector("dialog")!;
    const editor = dialog.querySelector("textarea")!;
    expect(JSON.parse(editor.value)).toEqual(result.Things[0]!.LinkToRename);

    editor.value = JSON.stringify({ $feature: "sample/RenameThing", Id: "t1", NewName: "Kettle" });
    [...dialog.querySelectorAll("button")].find(button => button.textContent === "Follow")!.click();

    expect(followed).toEqual([{ $feature: "sample/RenameThing", Id: "t1", NewName: "Kettle" }]);
  });

  it("won't follow what isn't a link", () => {
    renderGeneric(element, result, host);
    (element.querySelector("button.fw-link") as HTMLButtonElement).click();

    const dialog = document.querySelector("dialog")!;
    dialog.querySelector("textarea")!.value = "{\"Id\":\"t1\"}";
    [...dialog.querySelectorAll("button")].find(button => button.textContent === "Follow")!.click();

    expect(followed).toEqual([]);
    expect(dialog.querySelector(".fw-error")!.textContent).toMatch(/\$feature/);
  });
});
