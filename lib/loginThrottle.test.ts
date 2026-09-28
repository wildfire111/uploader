import { describe, expect, it } from "vitest";
import { isLoginLinkAllowed, MAX_LINKS_PER_EMAIL, MAX_LINKS_TOTAL } from "./loginThrottle";

describe("isLoginLinkAllowed", () => {
  it("allows a link when the counts are well under the limits", () => {
    expect(isLoginLinkAllowed({ forEmail: 1, total: 1 })).toBe(true);
  });

  it("allows the request that lands exactly on the per-address limit", () => {
    expect(isLoginLinkAllowed({ forEmail: MAX_LINKS_PER_EMAIL, total: MAX_LINKS_PER_EMAIL })).toBe(
      true
    );
  });

  it("refuses once one address has had more links than the per-address limit", () => {
    expect(isLoginLinkAllowed({ forEmail: MAX_LINKS_PER_EMAIL + 1, total: 10 })).toBe(false);
  });

  it("refuses once the total across everyone passes the overall limit, to protect the daily email quota", () => {
    expect(isLoginLinkAllowed({ forEmail: 1, total: MAX_LINKS_TOTAL + 1 })).toBe(false);
  });
});
