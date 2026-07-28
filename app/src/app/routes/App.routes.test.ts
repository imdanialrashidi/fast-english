import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Static checks for the App router. Avoids needing a DOM environment for a
// small but valuable regression guard against accidental route removal.

const appRoot = resolve(__dirname, '..', '..', '..');
const appSource = readFileSync(resolve(appRoot, 'src', 'app', 'App.tsx'), 'utf8');

const expectedRoutes = [
  '/',
  '/login',
  '/signup',
  '/dashboard',
  '/payment',
  '/payment-status',
  '/placement',
  '/lessons',
  '/lessons/demo',
  '/account',
  '/operator',
];

describe('app routes', () => {
  for (const route of expectedRoutes) {
    it(`declares the ${route} route`, () => {
      expect(appSource).toContain(`path="${route}"`);
    });
  }

  it('wraps authenticated routes with the shared AppShell', () => {
    expect(appSource).toMatch(/<Route element=\{<AppShell \/>\}>/);
  });

  it('falls back to the entry route for unknown paths', () => {
    expect(appSource).toContain('path="*"');
    expect(appSource).toContain('<Navigate to="/" replace />');
  });
});
