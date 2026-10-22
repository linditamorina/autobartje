import { describe, expect, it } from "vitest";
import { fillPlaceholders, slugify } from "./fill";
import { de } from "./de";
import { en } from "./en";
import { sq } from "./sq";
import { PAGE_SLUGS } from "./types";
import { DEFAULT_SETTINGS } from "@/server/settings/defaults";

describe("fillPlaceholders", () => {
  it("fills known settings and keeps unknown keys", () => {
    expect(fillPlaceholders("Call {{contact.phone}} or {{ nope }}", { "contact.phone": "+383 44" })).toBe("Call +383 44 or {{ nope }}");
  });
  it("blanks known but empty settings", () => {
    expect(fillPlaceholders("{{company.address}} Pejë", { "company.address": "" })).toBe(" Pejë");
  });
  it("leaves no placeholder unfilled in the default copy", () => {
    for (const set of [sq, en, de]) {
      for (const slug of PAGE_SLUGS) {
        const page = set[slug];
        const out = fillPlaceholders(`${page.title} ${page.description} ${page.body}`, DEFAULT_SETTINGS);
        expect(out, `${slug}`).not.toMatch(/\{\{/);
      }
    }
  });
});

describe("slugify", () => {
  it("strips diacritics and punctuation", () => {
    expect(slugify("Tërheqje në Pejë!")).toBe("terheqje-ne-peje");
    expect(slugify("  Straße & Zoll  ")).toBe("strasse-zoll");
  });
});
