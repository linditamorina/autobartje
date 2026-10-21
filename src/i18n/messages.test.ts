import { describe, expect, it } from "vitest";
import sq from "../../messages/sq.json";
import en from "../../messages/en.json";
import de from "../../messages/de.json";

function keys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? keys(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe("translations", () => {
  const reference = keys(sq).sort();
  it.each([
    ["en", en],
    ["de", de],
  ])("%s has exactly the same keys as sq", (_, messages) => {
    expect(keys(messages).sort()).toEqual(reference);
  });
});
