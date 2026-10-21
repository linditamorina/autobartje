/** Injects the admin-chosen brand colour as a CSS variable (light theme only; dark keeps its high-contrast palette). */
export function BrandStyle({ color }: { color: string }) {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return null;
  return <style>{`:root:not(.dark){--brand:${color};--brand-foreground:${readableOn(color)}}`}</style>;
}

/** Picks black or white text for a background colour using WCAG relative luminance. */
export function readableOn(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (1.05) / (lum + 0.05) >= (lum + 0.05) / 0.05 ? "#ffffff" : "#0b1220";
}
