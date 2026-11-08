import { describe, expect, it } from "vitest";
import { invoke } from "../src/bff.js";
import { fetcher } from "./fakes.js";

const link = { $feature: "sample/DeleteThing", Id: "t1" };

describe("a request to a UI backend", () => {
  it("posts a link to its feature, with the token and an idempotency key", async () => {
    const { fetch, calls } = fetcher({ body: { $case: "Deleted" } });

    const response = await invoke("/api/sample/", link, "POST", "a-token", fetch);

    const call = calls[0]!;
    expect(call.url).toBe("/api/sample/DeleteThing");
    expect(call.method).toBe("POST");
    expect(JSON.parse(call.body!)).toEqual(link);
    expect(call.headers["authorization"]).toBe("Bearer a-token");
    expect(call.headers["idempotency-key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(response).toMatchObject({ feature: "sample/DeleteThing", status: 200, contentType: "application/json", body: { $case: "Deleted" } });
  });

  it("loads a link by GET with the link in the query string, and no idempotency key", async () => {
    const { fetch, calls } = fetcher({ body: { Things: [] } });
    const things = { $feature: "sample/Things" };

    await invoke("/api/sample", things, "GET", null, fetch);

    const call = calls[0]!;
    expect(call.method).toBe("GET");
    expect(call.url).toBe(`/api/sample/Things?link=${encodeURIComponent(JSON.stringify(things))}`);
    expect(call.headers["idempotency-key"]).toBeUndefined();
    expect(call.headers["authorization"]).toBeUndefined();
  });

  it("reads the family of the feature that answered, or null if the backend doesn't say", async () => {
    const { fetch } = fetcher({ family: "command", body: { $case: "Deleted" } }, { body: {} });

    expect((await invoke("/api/sample", link, "POST", null, fetch)).family).toBe("command");
    expect((await invoke("/api/sample", link, "POST", null, fetch)).family).toBeNull();
  });

  it("reads a problem by its content type", async () => {
    const { fetch } = fetcher({ status: 404, contentType: "application/problem+json", body: { title: "Not found", status: 404, detail: "no" } });

    const response = await invoke("/api/sample", link, "POST", null, fetch);

    expect(response).toMatchObject({ status: 404, contentType: "application/problem+json", body: { detail: "no" } });
  });
});
