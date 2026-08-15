// landing/src/lib/publicSettings.ts
// Business Configuration slice — runtime public settings for the static
// Landing.
//
// The Landing stays lightweight: it fetches ONE public JSON endpoint
// (`/api/fast-english/public/settings`) with a plain `fetch()` — no
// PocketBase client, no Student auth, no MUI, no placement or Player
// infrastructure. The endpoint is the canonical source: active plans
// (prices live in the `plans` collection) and the support contact
// (`site_settings`), both owner-editable from the Admin Business Settings
// surface without rebuilding the Landing.
//
// Same-origin in every environment:
//   - production: a scoped Caddy handle on the landing domain proxies
//     exactly this path to PocketBase (deploy/Caddyfile);
//   - dev/e2e: the Vite server/preview proxy forwards `/api` to the local
//     PocketBase (vite.landing.config.ts).
//
// Failure behaviour is honest: when the endpoint is unreachable the pages
// show the neutral "prices inside the app" / "support not announced yet"
// states instead of fabricated values.

export interface PublicPlan {
  id: string;
  name: string;
  slug: string;
  durationDays: number;
  priceToman: number;
  displayOrder: number;
  description: string;
}

export interface PublicSettings {
  plans: PublicPlan[];
  support: { supportContact: string };
}

export const PUBLIC_SETTINGS_PATH = '/api/fast-english/public/settings';

/** True when the value looks like a clickable URL (https/http/mailto/tel). */
export function isContactUrl(value: string | null | undefined): boolean {
  const v = String(value ?? '').trim();
  return /^(https?:\/\/|mailto:|tel:)/i.test(v);
}

export function parsePublicSettings(raw: unknown): PublicSettings | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.plans)) return null;
  const plans: PublicPlan[] = [];
  for (const p of r.plans) {
    if (!p || typeof p !== 'object') return null;
    const rec = p as Record<string, unknown>;
    if (
      typeof rec.name !== 'string' ||
      typeof rec.slug !== 'string' ||
      typeof rec.durationDays !== 'number' ||
      typeof rec.priceToman !== 'number' ||
      typeof rec.displayOrder !== 'number'
    ) {
      return null;
    }
    plans.push({
      id: typeof rec.id === 'string' ? rec.id : '',
      name: rec.name,
      slug: rec.slug,
      durationDays: rec.durationDays,
      priceToman: rec.priceToman,
      displayOrder: rec.displayOrder,
      description: typeof rec.description === 'string' ? rec.description : '',
    });
  }
  const support = (r.support && typeof r.support === 'object' ? r.support : {}) as Record<
    string,
    unknown
  >;
  return {
    plans,
    support: {
      supportContact: typeof support.supportContact === 'string' ? support.supportContact : '',
    },
  };
}

let cached: Promise<PublicSettings | null> | null = null;

/**
 * Fetch the public settings once per page load (module-level cache).
 * Returns null on any failure — callers render honest fallback states.
 */
export function fetchPublicSettings(signal?: AbortSignal): Promise<PublicSettings | null> {
  if (!cached) {
    cached = (async () => {
      try {
        const res = await fetch(PUBLIC_SETTINGS_PATH, {
          headers: { accept: 'application/json' },
          signal: signal ?? AbortSignal.timeout(10_000),
        });
        if (!res.ok) return null;
        return parsePublicSettings(await res.json());
      } catch {
        return null;
      }
    })();
  }
  return cached;
}

/** Testing helper: reset the module cache (also used on error retry). */
export function resetPublicSettingsCache(): void {
  cached = null;
}
