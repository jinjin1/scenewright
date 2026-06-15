import { describe, expect, it } from "vitest";
import { escapeHtml } from "../../src/pipeline/html.js";

describe("escapeHtml", () => {
  it("escapes the HTML-significant characters", () => {
    expect(escapeHtml(`<a href="x">Tom & Jerry</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&lt;/a&gt;",
    );
  });

  it("escapes ampersand first so existing entities are not skipped", () => {
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });

  it("leaves plain text (incl. Korean) untouched", () => {
    expect(escapeHtml("plain 텍스트 123 — ok")).toBe("plain 텍스트 123 — ok");
  });
});
