---
name: technical-seo
description: Verify indexable public routes when content, metadata, URLs, rendering, robots, sitemap, canonical, structured data, or locale discovery changes. Use for an accepted search-discoverability criterion; do not use for private/admin routes or generic copy editing.
---

# Technical SEO

Audit the built/public artifact and the server behavior that search crawlers
actually receive. Use native OMP reads/browser and the repository's existing
build, crawl, or HTTP test commands; do not install an SEO crawler or claim
Search Console data that was not supplied.

## Procedure

1. Read the product/architecture/design/quality contract and classify the
   route as public, authenticated, `noindex`, or intentionally excluded. Never
   make a private route indexable just to satisfy an audit.
2. Check one representative URL and the relevant locale variants for status,
   redirects, server/HTML rendering, title, meta description, viewport,
   visible heading/content, canonical, robots directives, and internal links.
3. Check `robots.txt`, sitemap location and URL coverage, canonical consistency,
   trailing-slash/query handling, and 404/redirect behavior. Remember that
   `robots.txt` controls crawling, not guaranteed de-indexing; a `noindex`
   directive must be reachable to be observed.
4. Parse JSON-LD/structured data from the delivered HTML. Validate syntax,
   identity, required properties, and agreement with visible content. Check
   Open Graph/Twitter metadata only when sharing is in the accepted scope.
   Verify `hreflang`/language direction only when multiple locales exist.

## Evidence contract

Return URL, response/rendering source, observation, and `PASS`, `FAIL`,
`UNPROVEN`, or `BLOCKED` for each criterion. Distinguish source HTML from
client-only post-hydration DOM, lab crawl from production/field evidence, and
valid structured data from a guaranteed rich result. Do not invent titles,
schema values, keywords, or organization facts. A missing production crawl or
Search Console account is explicitly `UNPROVEN`.

Use the current [Google Search Essentials](https://developers.google.com/search/docs/essentials),
[structured-data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies),
and [canonical guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
when a rule is ambiguous. A citation informs the check; it does not prove the
route passes. Keep fixes limited to the accepted public discoverability scope.
