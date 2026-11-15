import { describe, expect, it } from "vitest";
import { argumentsOf, familyOf, featureOf, isLink, linkTo, qualifiedFeatureOf } from "../src/contract.js";

describe("a link", () => {
  it("names its feature in the one property that says the feature's family", () => {
    const claim = { $command: "lost-property/ClaimItem", ItemId: "F-000004" };

    expect(isLink(claim)).toBe(true);
    expect(familyOf(claim)).toBe("command");
    expect(qualifiedFeatureOf(claim)).toBe("lost-property/ClaimItem");
    expect(featureOf(claim)).toEqual(["lost-property", "ClaimItem"]);
    expect(argumentsOf(claim)).toEqual({ ItemId: "F-000004" });
    expect(linkTo("command", "lost-property/ClaimItem", { ItemId: "F-000004" })).toEqual(claim);
  });

  it("isn't a link unless it names exactly one feature", () => {
    expect(isLink({ ItemId: "F-000004" })).toBe(false);
    expect(isLink({ $query: "a/B", $command: "a/B" })).toBe(false);
    expect(isLink({ $feature: "a/B" })).toBe(false);
    expect(isLink([{ $query: "a/B" }])).toBe(false);
  });
});
