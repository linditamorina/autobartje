/** Replaces {{setting.key}} in page copy with the current admin setting; unknown keys stay as written. */
export function fillPlaceholders(text: string, values: Record<string, unknown>): string {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) => {
    const v = values[key];
    return v == null || v === "" ? (key in values ? "" : match) : String(v);
  });
}

/** URL-safe slug: "Tërheqje në Pejë!" → "terheqje-ne-peje". */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
