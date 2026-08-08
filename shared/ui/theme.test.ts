import { describe, expect, it } from 'vitest';
import { appTheme } from './theme';
import { cefr, cefrLevels } from './tokens/cefr';
import { semanticColors } from './tokens/colors';

describe('product app theme', () => {
  it('uses RTL direction for the MUI theme', () => {
    expect(appTheme.direction).toBe('rtl');
  });

  it('enables MUI CSS theme variables', () => {
    const theme = appTheme as unknown as { vars?: object };
    expect(theme.vars).toBeTypeOf('object');
  });

  it('defines Light and Dark color schemes with a data-attribute selector', () => {
    expect(appTheme.colorSchemes.light?.palette.mode).toBe('light');
    expect(appTheme.colorSchemes.dark?.palette.mode).toBe('dark');
    // With both schemes present MUI defaults the selector to `media`, which
    // disables manual setMode — the explicit data selector is mandatory.
    expect(appTheme.colorSchemeSelector).toBe('data-color-scheme');
  });

  it('maps every semantic role into the active palette', () => {
    const palette = appTheme.palette as unknown as Record<string, unknown>;
    // MUI models these as PaletteColor/objects; the rest must be raw strings.
    const objectRoles = new Set([
      'primary',
      'onPrimary',
      'secondary',
      'onSecondary',
      'success',
      'onSuccess',
      'warning',
      'onWarning',
      'error',
      'onError',
      'info',
      'onInfo',
      'background',
      'text',
    ]);
    for (const role of Object.keys(semanticColors.light)) {
      if (objectRoles.has(role)) continue;
      expect(palette[role], `missing palette role ${role}`).toBeTypeOf('string');
    }
    // Nested role mapping (MUI PaletteColor shape).
    const c = semanticColors.light;
    const primary = palette.primary as { main: string; contrastText: string };
    expect(primary.main).toBe(c.primary);
    expect(primary.contrastText).toBe(c.onPrimary);
    const text = palette.text as { primary: string; secondary: string };
    expect(text.primary).toBe(c.onSurface);
    expect(text.secondary).toBe(c.onSurfaceVariant);
    // Spot-check one role across schemes.
    expect(appTheme.colorSchemes.light?.palette.primaryContainer).toBe(
      semanticColors.light.primaryContainer,
    );
    expect(appTheme.colorSchemes.dark?.palette.primaryContainer).toBe(
      semanticColors.dark.primaryContainer,
    );
  });

  it('exposes the elevation tokens per scheme', () => {
    const theme = appTheme as unknown as { elevation?: Record<string, string> };
    expect(theme.elevation).toBeTypeOf('object');
    expect(theme.elevation?.dialog).toContain('rgba');
  });

  it('defines all six CEFR levels with background and foreground', () => {
    expect(cefrLevels).toEqual(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
    for (const level of cefrLevels) {
      expect(cefr[level].bg).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(cefr[level].fg).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('uses Vazirmatn as the primary font family', () => {
    expect(appTheme.typography.fontFamily).toContain('Vazirmatn');
  });

  it('does not uppercase Button labels', () => {
    const buttonVariant = appTheme.typography.button;
    expect(buttonVariant?.textTransform).toBe('none');
  });

  it('does not use the supplied light primary as a text-bearing fill', () => {
    // `#4f95b5` fails AA for white text; the semantic Light primary must be
    // darker (see palette.contrast.test.ts for the computed ratios).
    const lightPrimary = appTheme.colorSchemes.light?.palette.primary.main;
    expect(lightPrimary?.toLowerCase()).not.toBe('#4f95b5');
  });

  it('uses the supplied brand values in the semantic system', () => {
    // Dark primary keeps the supplied dark primary; the supplied light
    // secondary becomes the secondaryContainer role.
    expect(appTheme.colorSchemes.dark?.palette.primary.main.toLowerCase()).toBe('#4a90b0');
    expect(appTheme.colorSchemes.light?.palette.secondaryContainer.toLowerCase()).toBe('#a3c9dc');
  });

  it('keeps the AppBar on a tonal surface with semantic foreground', () => {
    const appBar = appTheme.components?.MuiAppBar?.styleOverrides?.root as
      | { color?: string }
      | undefined;
    expect(appBar?.color).toBe('var(--mui-palette-onSurface)');
  });
});
