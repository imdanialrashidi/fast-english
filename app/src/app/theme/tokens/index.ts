// Design-token barrel. All app-side visual constants flow through here;
// components must not inline raw hex values, arbitrary radii, box shadows,
// animation durations or z-indexes (enforced by static-quality.test.ts).

export * from './colors';
export * from './elevation';
export * from './focus';
export * from './motion';
export * from './shape';
export * from './spacing';
export * from './typography';
