---
name: rtl-i18n
description: Design, implement, or audit localized UI for Persian, Arabic, Hebrew, RTL switching, mixed-direction content, translation length, or locale-sensitive formatting. Use when direction or internationalization is part of the accepted surface; do not use for a translation-only request without layout behavior.
---

# RTL and internationalization

Treat direction, language, content length, and formatting as behavior. Use the
project's existing localization system and OMP's native browser; do not add a
translation framework or pseudo-locale dependency to a template that does not
already use one.

## Procedure

1. Read the accepted product/design/quality contract and identify supported
   locales, direction-switch behavior, fallback locale, critical journeys, and
   strings that may contain URLs, code, identifiers, numbers, or user content.
2. Verify document `lang`/`dir`, direction-aware layout, and CSS logical
   properties (`margin-inline`, `inset-inline`, `text-align: start/end`, and
   equivalent grid/flex rules). Check icons, charts, carousels and navigation
   for intentional mirroring rather than blind flipping.
3. Exercise long/short/empty/error translations at a narrow viewport and with
   the direction switched at runtime when supported. Check forms, validation,
   focus order, truncation/overflow, dates, numbers, currency, pluralization,
   and timezone assumptions.
4. Keep LTR islands (URLs, email, code, phone numbers, identifiers) readable
   and isolated. Use Unicode bidi isolation where user-controlled mixed text
   crosses a boundary; never “fix” spoofing or ordering issues with visual
   punctuation alone.

## Evidence contract

Report locale, direction, route/state/viewport, exact observation, and
`PASS`, `FAIL`, `UNPROVEN`, or `BLOCKED`. A screenshot may support composition,
but DOM semantics, keyboard behavior, and computed direction need direct
evidence. If a locale fixture or browser cannot run, preserve the limitation
and do not infer coverage from an English/LTR pass.

Use the project's existing tests for durable behavior. Add a test only through
`test-design` when it protects a distinct regression (for example a mixed bidi
boundary or long-string overflow). Consult [CSS Logical Properties](https://www.w3.org/TR/css-logical-1/)
and [Unicode Bidirectional Algorithm](https://www.unicode.org/reports/tr9/)
for version-sensitive or security-sensitive questions; standards text is not
product evidence.
