// Motion tokens.
//
// Durations and easings follow Material 3 naming. Motion is used only for
// navigation changes, selected states, Dialog/Sheet entrances, progress,
// success feedback, expandable content, the Mini Player transition,
// theme-control feedback and controlled route entry — never for decorative
// loops. Prefer transform/opacity. `prefers-reduced-motion` collapses all
// durations (see theme MuiCssBaseline override).

export const duration = {
  durationInstant: 80,
  durationFast: 150,
  durationStandard: 240,
  durationEmphasized: 420,
} as const;

export const easing = {
  easingStandard: 'cubic-bezier(0.2, 0, 0, 1)',
  easingDecelerate: 'cubic-bezier(0, 0, 0.2, 1)',
  easingAccelerate: 'cubic-bezier(0.4, 0, 1, 1)',
  easingEmphasized: 'cubic-bezier(0.3, 0, 0.4, 1)',
} as const;

export const motion = {
  duration,
  easing,
  // Theme-control feedback (mode switch) uses an instant, non-moving state
  // change plus a short cross-fade of surfaces.
  themeSwitch: {
    duration: duration.durationFast,
    easing: easing.easingStandard,
    property: 'background-color, color',
  },
  dialog: {
    duration: duration.durationEmphasized,
    easing: easing.easingEmphasized,
  },
  navigation: {
    duration: duration.durationStandard,
    easing: easing.easingStandard,
  },
} as const;
