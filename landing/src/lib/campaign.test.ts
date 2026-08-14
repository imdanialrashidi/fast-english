// landing/src/lib/campaign.test.ts
// Safe campaign/referral preservation contract for landing → web-app
// cross-domain CTAs: only the allowlist is forwarded, values are bounded,
// and nothing else leaks into the app URL.
import { describe, expect, it } from 'vitest';
import { appUrlWithCurrentCampaign, buildAppUrlWithCampaign } from './campaign';

const BASE = 'https://app.fastenglishpodcast.com';

describe('buildAppUrlWithCampaign', () => {
  it('returns the base URL unchanged without query params', () => {
    expect(buildAppUrlWithCampaign(BASE, '')).toBe(BASE);
    expect(buildAppUrlWithCampaign(BASE, '?')).toBe(BASE);
  });

  it('forwards only the allowlisted campaign/referral parameters', () => {
    expect(
      buildAppUrlWithCampaign(
        BASE,
        '?utm_source=landing&utm_medium=organic&utm_campaign=launch&utm_term=english&utm_content=hero&ref=partner',
      ),
    ).toBe(
      `${BASE}?utm_source=landing&utm_medium=organic&utm_campaign=launch&utm_term=english&utm_content=hero&ref=partner`,
    );
  });

  it('drops every non-allowlisted parameter (tokens, ids, arbitrary keys)', () => {
    expect(
      buildAppUrlWithCampaign(
        BASE,
        '?token=SECRET&session=abc123&next=%2Fpayment&utm_source=landing&fbclid=xyz',
      ),
    ).toBe(`${BASE}?utm_source=landing`);
  });

  it('drops empty and whitespace-only values', () => {
    expect(buildAppUrlWithCampaign(BASE, '?utm_source=&utm_medium=+&utm_campaign=x')).toBe(
      `${BASE}?utm_campaign=x`,
    );
  });

  it('drops over-long values to keep URLs sane', () => {
    const long = 'x'.repeat(101);
    expect(buildAppUrlWithCampaign(BASE, `?utm_campaign=${long}`)).toBe(BASE);
    expect(buildAppUrlWithCampaign(BASE, `?utm_source=${'x'.repeat(100)}`)).toBe(
      `${BASE}?utm_source=${'x'.repeat(100)}`,
    );
  });

  it('encodes values safely', () => {
    expect(buildAppUrlWithCampaign(BASE, '?utm_campaign=a b&ref=c/d')).toBe(
      `${BASE}?utm_campaign=a+b&ref=c%2Fd`,
    );
  });

  it('does not double the query when the base URL already carries one', () => {
    expect(buildAppUrlWithCampaign(`${BASE}/?x=1#sec`, '?utm_source=landing')).toBe(
      `${BASE}/?utm_source=landing`,
    );
  });
});

describe('appUrlWithCurrentCampaign', () => {
  it('is SSR-safe: returns the bare base URL without window', () => {
    expect(appUrlWithCurrentCampaign(BASE)).toBe(BASE);
  });
});
