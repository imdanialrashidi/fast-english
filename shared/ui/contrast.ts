// WCAG 2.x contrast utilities. Pure functions; no dependencies.
// Used by palette.contrast.test.ts (the machine-readable contrast gate)
// and by the browser-based contrast checks in e2e/visual-slice-1.spec.ts.

export type Rgb = readonly [r: number, g: number, b: number];

/** Parse `#rgb`, `#rrggbb` or `rgba(r, g, b, a)` into 0-255 RGB. */
export function parseColor(input: string): Rgb {
  const value = input.trim();
  if (value.startsWith('#')) {
    const hex = value.slice(1);
    const full =
      hex.length === 3
        ? hex
            .split('')
            .map((c) => c + c)
            .join('')
        : hex;
    if (full.length !== 6) throw new Error(`Unsupported hex color: ${input}`);
    const parts = [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16));
    return [parts[0], parts[1], parts[2]];
  }
  const rgba = value.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (rgba) {
    return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])];
  }
  throw new Error(`Unsupported color format: ${input}`);
}

/** Relative luminance (WCAG 2.x definition). */
export function relativeLuminance(color: string): number {
  const [r, g, b] = parseColor(color).map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colors (order independent). */
export function contrastRatio(fg: string, bg: string): number {
  const a = relativeLuminance(fg);
  const b = relativeLuminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * Blend a translucent color over an opaque background and return the
 * resulting opaque color (for verifying contrast of rgba tokens such as
 * `scrim` or translucent overlays against real surfaces).
 */
export function blendOver(foreground: string, background: string): string {
  const fg = parseColor(foreground);
  const bg = parseColor(background);
  const alphaMatch = foreground.trim().match(/rgba?\([\d.]+,\s*[\d.]+,\s*[\d.]+,\s*([\d.]+)\)/i);
  const alpha = alphaMatch ? Math.min(1, Number(alphaMatch[1])) : 1;
  const out = fg.map((f, i) => Math.round(f * alpha + bg[i] * (1 - alpha)));
  return `rgb(${out[0]}, ${out[1]}, ${out[2]})`;
}
