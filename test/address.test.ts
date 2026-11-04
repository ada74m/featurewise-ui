import { describe, expect, it } from "vitest";
import { pathOf, placeOf, shellPath } from "../src/address.js";

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
