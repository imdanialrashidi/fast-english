import { describe, expect, it } from 'vitest';
import {
  apkAvailable,
  DEFAULT_WEB_APP_URL,
  resolveApkState,
  resolveSupportUrl,
  resolveWebAppUrl,
} from './lib/siteConfig';

describe('resolveApkState', () => {
  it('returns an honest unavailable state when nothing is configured', () => {
    const state = resolveApkState(null, null);
    expect(state).toEqual({ url: null, version: null });
    expect(apkAvailable(state)).toBe(false);
  });

  it('accepts a configured official https APK URL with version', () => {
    const url = 'https://fastenglishpodcast.com/releases/app-1.0.0.apk';
    const state = resolveApkState(url, '1.0.0');
    expect(state).toEqual({ url, version: '1.0.0' });
    expect(apkAvailable(state)).toBe(true);
  });

  it('never fabricates a link from non-https, local, or invalid values', () => {
    for (const bad of [
      'http://fastenglishpodcast.com/app.apk',
      'file:///home/user/app.apk',
      '/home/user/app.apk',
      'assets/app.apk',
      'https://localhost:8080/app.apk',
      'https://127.0.0.1/app.apk',
      'not-a-url',
      '  ',
    ]) {
      const state = resolveApkState(bad, null);
      expect(apkAvailable(state), bad).toBe(false);
      expect(state.url).toBeNull();
    }
  });

  it('drops an empty version but keeps a valid URL', () => {
    const url = 'https://fastenglishpodcast.com/app.apk';
    expect(resolveApkState(url, '')).toEqual({ url, version: null });
    expect(resolveApkState(url, '   ')).toEqual({ url, version: null });
  });
});

describe('resolveWebAppUrl', () => {
  it('defaults safely to the production web app', () => {
    expect(resolveWebAppUrl(null)).toBe(DEFAULT_WEB_APP_URL);
    expect(resolveWebAppUrl('')).toBe(DEFAULT_WEB_APP_URL);
    expect(resolveWebAppUrl('http://localhost:5173')).toBe(DEFAULT_WEB_APP_URL);
  });

  it('keeps a configured https web app URL', () => {
    expect(resolveWebAppUrl('https://app.example.com/')).toBe('https://app.example.com');
  });
});

describe('resolveSupportUrl', () => {
  it('is null when not configured', () => {
    expect(resolveSupportUrl(null)).toBeNull();
    expect(resolveSupportUrl('')).toBeNull();
  });

  it('accepts only https absolute URLs', () => {
    expect(resolveSupportUrl('https://t.me/channel')).toBe('https://t.me/channel');
    expect(resolveSupportUrl('mailto:support@example.com')).toBeNull();
    expect(resolveSupportUrl('tel:+98912')).toBeNull();
  });
});
