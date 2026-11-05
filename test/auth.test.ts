import { describe, expect, it } from "vitest";
import { devAuth, unsignedToken } from "../src/auth.js";

const claimsOf = (token: string) =>
  JSON.parse(atob(token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/")));

describe("signing in without a real sign-in", () => {
  it("makes an unsigned token with the claims Cognito's would have", () => {
    expect(claimsOf(unsignedToken({ id: "ann", groups: ["editor"] })))
      .toEqual({ username: "ann", "cognito:groups": ["editor"] });
  });

  it("remembers who was chosen until they log out, and says when it changes", () => {
    localStorage.clear();
    const auth = devAuth([{ id: "ann" }, { id: "bob" }]);
    let changes = 0;
    auth.onChange(() => changes++);

    expect(auth.current()).toBeNull();
    auth.signInAs({ id: "bob" });
    expect(auth.current()?.username).toBe("bob");
    auth.signOut();
    expect(auth.current()).toBeNull();
    expect(changes).toBe(2);
  });
});
