import { beforeEach, describe, expect, it } from "vitest";
import { storedCustomisations } from "../src/customisation.js";

describe("a module's rendering", () => {
  beforeEach(() => localStorage.clear());

  it("is on until turned off", () => {
    expect(storedCustomisations().of("sample")).toEqual({ render: true });
  });

  it("remembers what was turned off, for that service only", () => {
    storedCustomisations().set("sample", { render: false });

    expect(storedCustomisations().of("sample")).toEqual({ render: false });
    expect(storedCustomisations().of("other")).toEqual({ render: true });
  });

  it("forgets a service once it is back on", () => {
    const customisations = storedCustomisations();
    customisations.set("sample", { render: false });
    customisations.set("sample", { render: true });

    expect(localStorage.length).toBe(0);
  });

  it("treats something unreadable as on", () => {
    localStorage.setItem("fw-customisation:sample", "not json");

    expect(storedCustomisations().of("sample")).toEqual({ render: true });
  });
});
