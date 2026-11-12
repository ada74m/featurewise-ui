import { describe, expect, it } from "vitest";
import { readConfig } from "../src/config.js";
import { config } from "./fakes.js";

describe("services.json", () => {
  it("is read when every service has a module and a backend", () => {
    expect(readConfig(config)).toBe(config);
  });

  it("can't name a service starting with _, which the shell's own pages use", () => {
    expect(() => readConfig({ default: "/", services: { _shell: { module: "m", bff: "b" } } })).toThrow(/_/);
  });

  it("needs every setting for signing in, if it has any", () => {
    expect(() => readConfig({ ...config, signIn: { authorizeUrl: "a", tokenUrl: "t", clientId: "c" } })).toThrow(/logoutUrl/);
  });

  it("needs a module and a backend for each service", () => {
    expect(() => readConfig({ default: "/", services: { sample: { module: "m" } } })).toThrow(/bff/);
  });

  it("takes the older dev users as personas", () => {
    const read = readConfig({ default: "/", services: {}, devUsers: [{ username: "ann", groups: ["editor"] }] });

    expect(read.personas).toEqual([{ id: "ann", groups: ["editor"] }]);
  });

  it("needs an id for each persona", () => {
    expect(() => readConfig({ default: "/", services: {}, personas: [{ label: "Nobody" }] })).toThrow();
  });

  it("refuses two personas with one id, since a persona is named by its id alone", () => {
    expect(() => readConfig({
      default: "/", services: {},
      demos: [{ id: "a", personas: [{ id: "staff" }] }, { id: "b", personas: [{ id: "staff" }] }]
    })).toThrow(/staff/);
  });

  it("offers each demo's personas as personas of that demo", () => {
    const read = readConfig({ default: "/", services: {}, demos: [{ id: "lost-property", personas: [{ id: "clerk", groups: ["clerk"] }] }] });

    expect(read.personas).toEqual([{ id: "clerk", groups: ["clerk"], demo: "lost-property" }]);
  });
});
