// Focus tokens.
//
// One visible focus treatment: a 2px ring in `focusRing` (mode-aware) with
// a 2px offset, applied via the theme's MuiCssBaseline `:focus-visible`
// override. The ring color is checked at >= 3:1 against the surfaces it
// appears on (see palette.contrast.test.ts).

import { semanticDark, semanticLight } from './colors';

export const focus = {
  ringWidth: 2,
  ringOffset: 2,
  color: { light: semanticLight.focusRing, dark: semanticDark.focusRing },
} as const;
