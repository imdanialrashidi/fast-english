import { describe, expect, it } from 'vitest';
import { appTheme } from './theme';
import { cefr, cefrLevels } from './tokens';

describe('product app theme', () => {
  it('uses RTL direction for the MUI theme', () => {
    expect(appTheme.direction).toBe('rtl');
  });

  it('enables MUI CSS theme variables', () => {
    // When cssVariables is true, MUI populates the theme's `vars` namespace.
    const theme = appTheme as unknown as { vars?: object };
    expect(theme.vars).toBeTypeOf('object');
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

  it('sets a midnight AppBar color and a light reading surface', () => {
    const appBar = appTheme.components?.MuiAppBar?.styleOverrides?.root as
      | { backgroundColor?: string }
      | undefined;
    expect(appBar?.backgroundColor?.toLowerCase()).toBe('#0b1220');
    expect(appTheme.palette.background.default.toLowerCase()).toBe('#f6f8fc');
  });
});
