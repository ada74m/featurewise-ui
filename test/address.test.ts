import { describe, expect, it } from "vitest";
import { defaultAddressOf, linkOfDefaultAddress, pathOf, placeOf, shellPath } from "../src/address.js";

describe("a URL's path", () => {
  it("names a service and the address within it", () => {
    expect(placeOf("/sample/things", "?page=2")).toEqual({ kind: "service", service: "sample", address: "things?page=2" });
    expect(placeOf("/sample")).toEqual({ kind: "service", service: "sample", address: "" });
  });

  it("leads to the default when it's empty", () => {
    expect(placeOf("/")).toEqual({ kind: "default" });
  });

  it("leads to the shell's own pages under _shell", () => {
    expect(placeOf(shellPath("services"))).toEqual({ kind: "shell", page: "services" });
  });

  it("is made from a service and an address", () => {
    expect(pathOf("sample", "things")).toBe("/sample/things");
  });
});

describe("the shell's default address for a query", () => {
  it("is the feature's name, with the rest of the link as JSON", () => {
    const address = defaultAddressOf({ $feature: "demos/ItemsFoundAt", Station: "Leeds" });

    expect(address).toBe(`_/ItemsFoundAt?link=${encodeURIComponent('{"Station":"Leeds"}')}`);
    expect(linkOfDefaultAddress("demos", address)).toEqual({ $feature: "demos/ItemsFoundAt", Station: "Leeds" });
  });

  it("is just the feature's name when the link has no arguments", () => {
    expect(defaultAddressOf({ $feature: "demos/UnclaimedItems" })).toBe("_/UnclaimedItems");
    expect(linkOfDefaultAddress("demos", "_/UnclaimedItems")).toEqual({ $feature: "demos/UnclaimedItems" });
  });

  it("isn't any address a module gives", () => {
    expect(linkOfDefaultAddress("demos", "lost-property/unclaimed-items")).toBeNull();
  });

  it("names the feature in its path, whatever its JSON says", () => {
    const address = `_/UnclaimedItems?link=${encodeURIComponent('{"$feature":"other/Secrets"}')}`;

    expect(linkOfDefaultAddress("demos", address)).toEqual({ $feature: "demos/UnclaimedItems" });
  });

  it("doesn't make a link when its JSON isn't an object", () => {
    expect(() => linkOfDefaultAddress("demos", "_/UnclaimedItems?link=%5B%5D")).toThrow();
  });
});
