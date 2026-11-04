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
});
