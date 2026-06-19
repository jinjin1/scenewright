import { describe, expect, it } from "vitest";
import { assertValidSlug, SLUG_PATTERN } from "../../src/pipeline/slug.js";

describe("assertValidSlug", () => {
  it("accepts lowercase-alphanumeric-hyphen slugs", () => {
    expect(() => assertValidSlug("pmf-discovery")).not.toThrow();
    expect(() => assertValidSlug("ep01")).not.toThrow();
    expect(() => assertValidSlug("a")).not.toThrow();
  });

  it("rejects path traversal attempts", () => {
    expect(() => assertValidSlug("../../etc")).toThrow(/invalid slug/);
    expect(() => assertValidSlug("foo/bar")).toThrow(/invalid slug/);
    expect(() => assertValidSlug("./foo")).toThrow(/invalid slug/);
  });

  it("rejects uppercase, spaces, dots, underscores", () => {
    expect(() => assertValidSlug("PMF")).toThrow(/invalid slug/);
    expect(() => assertValidSlug("with space")).toThrow(/invalid slug/);
    expect(() => assertValidSlug("foo.bar")).toThrow(/invalid slug/);
    expect(() => assertValidSlug("foo_bar")).toThrow(/invalid slug/);
  });

  it("rejects undefined and empty string", () => {
    expect(() => assertValidSlug(undefined)).toThrow(/invalid slug/);
    expect(() => assertValidSlug("")).toThrow(/invalid slug/);
  });

  it("SLUG_PATTERN matches the documented charset", () => {
    expect(SLUG_PATTERN.test("ok-1-2-3")).toBe(true);
    expect(SLUG_PATTERN.test("nope/x")).toBe(false);
  });
});
