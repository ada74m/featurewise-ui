import { describe, expect, it, vi } from "vitest";
import { fitFrame, heightMessage, isFramed } from "../src/frame.js";

describe("the shell in a frame", () => {
  // A window whose parent is another, recording what's posted to it, and a body of a given height.
  function framed(height: number) {
    const posted: unknown[] = [];
    const parent = { postMessage: vi.fn((message: unknown) => posted.push(message)) };
    let current = height;
    Object.defineProperty(document.body, "scrollHeight", { configurable: true, get: () => current });
    const frame = Object.create(window, { parent: { value: parent }, document: { value: document } }) as Window;
    return { frame, posted, grow: (to: number) => { current = to; } };
  }

  it("knows when it's framed", () => {
    expect(isFramed(window)).toBe(false);
    expect(isFramed(framed(0).frame)).toBe(true);
  });

  it("marks the page, and posts its height at once and whenever it changes", () => {
    const { frame, posted, grow } = framed(400);
    let changed = () => {};

    fitFrame(frame, (_, callback) => { changed = callback; });
    grow(650);
    changed();
    changed();

    expect(document.documentElement.classList.contains("fw-framed")).toBe(true);
    expect(posted).toEqual([{ type: heightMessage, height: 400 }, { type: heightMessage, height: 650 }]);
  });
});
