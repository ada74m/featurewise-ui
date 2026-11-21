import { describe, expect, it } from "vitest";
import { featurewiseModule, type Host, type Renderer, type ShellResponse } from "../src/module/index.js";

const host: Host = { follow: () => {}, toast: () => {}, embed: () => () => {}, pathOf: () => null };
const element = {} as HTMLElement;

const response = (feature: string, body: unknown): ShellResponse =>
  ({ link: { $command: feature }, feature, family: "command", status: 200, contentType: "application/json", body });

// A renderer that records what it was given.
function recording() {
  const seen: unknown[] = [];
  const renderer: Renderer = (_, body) => {
    seen.push(body);
    return () => {};
  };
  return { seen, renderer };
}

describe("a module's addresses", () => {
  const ui = featurewiseModule("shop", { home: "aisles" });
  ui.addQuery("Aisles").address("aisles");
  ui.addQuery("ShelvesIn").address("aisles/{Aisle}/shelves");
  ui.addQuery("Shelf").address("aisles/{Aisle}/shelves/{Number:int}");
  ui.addQuery("DeliveriesOn").address("deliveries/{On:date}");
  ui.addQuery("Basket");
  ui.addCommand("BuyThing");

  it("lead from a query's link to its address and back", () => {
    for (const [address, link] of [
      ["aisles", { $query: "shop/Aisles" }],
      ["aisles/Tins%20and%20jars/shelves", { $query: "shop/ShelvesIn", Aisle: "Tins and jars" }],
      ["aisles/Bakery/shelves/3", { $query: "shop/Shelf", Aisle: "Bakery", Number: 3 }],
      ["deliveries/2026-11-13", { $query: "shop/DeliveriesOn", On: "2026-11-13" }]
    ] as const) {
      expect(ui.linkToAddress(link)).toBe(address);
      expect(ui.addressToLink(address)).toEqual(link);
    }
  });

  it("take the home address for the service's own path, and ignore a query string", () => {
    expect(ui.addressToLink("")).toEqual({ $query: "shop/Aisles" });
    expect(ui.addressToLink("aisles?utm=book")).toEqual({ $query: "shop/Aisles" });
  });

  it("read only what fits the template's kinds", () => {
    expect(ui.addressToLink("aisles/Bakery/shelves/three")).toBeNull();
    expect(ui.addressToLink("aisles/Bakery/shelves/3.5")).toBeNull();
    expect(ui.addressToLink("deliveries/Friday")).toBeNull();
    expect(ui.addressToLink("aisles//shelves")).toBeNull();
    expect(ui.addressToLink("nowhere")).toBeNull();
  });

  it("leave out the invocation that made the link, which isn't one of its arguments", () => {
    expect(ui.linkToAddress({ $query: "shop/ShelvesIn", Aisle: "Bakery", CausedBy: "00-4bf9-00f0-01" })).toBe("aisles/Bakery/shelves");
  });

  it("leave a link to the shell's default unless the address holds exactly its arguments", () => {
    expect(ui.linkToAddress({ $query: "shop/ShelvesIn", Aisle: "Bakery", Extra: 1 })).toBeNull();
    expect(ui.linkToAddress({ $query: "shop/ShelvesIn" })).toBeNull();
    expect(ui.linkToAddress({ $query: "shop/ShelvesIn", Aisle: null })).toBeNull();
    expect(ui.linkToAddress({ $query: "shop/Shelf", Aisle: "Bakery", Number: "3" })).toBeNull();
  });

  it("are given only to the queries that ask for one", () => {
    expect(ui.linkToAddress({ $query: "shop/Basket" })).toBeNull();
    expect(ui.linkToAddress({ $command: "shop/BuyThing" })).toBeNull();
    expect("address" in ui.addCommand("ReturnThing")).toBe(false);
  });

  it("refuse templates that couldn't be read back", () => {
    const other = featurewiseModule("other");
    expect(() => other.addQuery("A").address("a/{X}/{X}")).toThrow();
    expect(() => other.addQuery("B").address("b-{X}")).toThrow();
    expect(() => other.addQuery("C").address("_/c")).toThrow();
    other.addQuery("D").address("d/{X}");
    expect(() => other.addQuery("E").address("d/{Y}")).toThrow();
  });
});

describe("a module's rendering", () => {
  it("renders a result by its feature, and by its case if it has one", () => {
    const ui = featurewiseModule("shop");
    const aisles = recording();
    const bought = recording();
    ui.addQuery("Aisles").render(aisles.renderer);
    ui.addCommand("BuyThing").renderCase("Bought", bought.renderer);

    expect(ui.render(element, response("shop/Aisles", { Aisles: [] }), host)).not.toBeNull();
    expect(ui.render(element, response("shop/BuyThing", { $case: "Bought", Thing: "Tea" }), host)).not.toBeNull();
    expect(aisles.seen).toEqual([{ Aisles: [] }]);
    expect(bought.seen).toEqual([{ $case: "Bought", Thing: "Tea" }]);
  });

  it("leaves every feature and case it wasn't given to the generic renderer", () => {
    const ui = featurewiseModule("shop");
    ui.addCommand("BuyThing").renderCase("Bought", recording().renderer);

    expect(ui.render(element, response("shop/BuyThing", { $case: "OutOfStock" }), host)).toBeNull();
    expect(ui.render(element, response("shop/Basket", {}), host)).toBeNull();
    expect(ui.render(element, response("elsewhere/BuyThing", { $case: "Bought" }), host)).toBeNull();
  });

  it("refuses a feature, or a case, added twice", () => {
    const ui = featurewiseModule("shop");
    const buy = ui.addCommand("BuyThing").renderCase("Bought", recording().renderer);
    expect(() => buy.renderCase("Bought", recording().renderer)).toThrow();
    expect(() => ui.addQuery("BuyThing")).toThrow();
  });
});
