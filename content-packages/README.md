# Content Packages

This directory holds **Episode Content Packages** — the human-editable
source of truth for the Fast English Podcast content pipeline
(Podcast Slice 3). One directory per Episode:

```text
content-packages/
└── example-episode/
    ├── episode.json        ← the manifest (see below)
    ├── README.md           ← editor notes for this Episode
    ├── artwork/
    │   ├── square.png      ← Episode artwork (JPEG/PNG/WebP, ≤5 MB, square)
    │   └── hero.png        ← optional wide hero (landscape, ~16:9)
    ├── audio/
    │   ├── b1.mp3          ← one audio file per Variant (MP3/M4A, ≤10 MB)
    │   └── c1.mp3
    └── transcripts/
        ├── b1.md           ← one UTF-8 Markdown transcript per Variant
        └── c1.md
```

## The normal workflow

```text
Create template
→ add artwork, audio, transcripts and vocabulary
→ validate locally
→ inspect dry-run
→ import as Draft
→ preview and publish later in Admin Console
```

```bash
pnpm content:new example-episode            # create a template (B1)
pnpm content:new example-episode --levels A1,B1,C1
pnpm content:validate content-packages/example-episode
pnpm content:plan    content-packages/example-episode
pnpm content:import  content-packages/example-episode   # asks for confirmation
pnpm content:import  content-packages/example-episode --yes   # automation
```

The template deliberately **fails validation** until every
`TODO_REPLACE` value is replaced with real content.

## The manifest (`episode.json`)

```jsonc
{
  "$schema": "../../schemas/episode-package.schema.json",
  "schemaVersion": "1.0.0",          // supported specification version
  "contentKey": "general.example-episode",  // must equal "<categoryKey>.<slug>"
  "contentVersion": 1,               // positive integer; bump to update
  "categoryKey": "general",          // must already exist in the database
  "episode": {
    "slug": "example-episode",       // lowercase letters/digits, hyphens
    "titleEn": "Pyramids of Egypt",  // required (≤120)
    "titleFa": "اهرام مصر",           // required Persian title (≤200)
    "descriptionFa": "…",            // required Persian description (≤2000)
    "artworkSquare": "artwork/square.png",  // required, safe relative path
    "heroImageWide": "artwork/hero.png",    // optional
    "artworkAltFa": "…",             // required Persian alt text
    "episodeNumber": 1,              // optional positive integer
    "featured": false                // optional boolean
  },
  "variants": [                      // one or more CEFR levels
    {
      "level": "B1",                 // A1 | A2 | B1 | B2 | C1 | C2 (unique)
      "summaryFa": "…",              // required Persian summary (≤500)
      "audio": "audio/b1.mp3",       // required relative path (MP3/M4A)
      "transcript": "transcripts/b1.md",  // required relative path
      "vocabulary": [                // optional but strongly recommended
        {
          "term": "pyramid",         // required display term
          "phonetic": "/ˈpɪrəmɪd/",  // optional
          "partOfSpeech": "noun",    // optional
          "meaningFa": "هرم",         // required Persian meaning
          "definitionEn": "…",       // required English definition
          "exampleSentence": "…",    // optional
          "pronunciationAudio": "audio/pyramid.mp3"  // optional MP3/M4A ≤2 MB
        }
      ]
    }
  ]
}
```

Rules to remember:

- **Assets are files, never Base64.** The manifest only references
  package-relative paths.
- **Paths must stay inside the package.** `../`, absolute paths, Windows
  drive paths, backslashes and symlinks pointing outside the package are
  rejected (both locally and server-side).
- **Levels are unique**; duplicate vocabulary terms (case/space-insensitive)
  are rejected.
- **The Category must already exist.** The pipeline never creates
  Categories (a typo is a hard error, not a silent new Category).
- **Imports are always Draft.** Nothing is ever published by the pipeline.

## Copywriting thresholds (explicit, documented)

Blocking: empty titles/descriptions/summaries, placeholder values
(`TODO_REPLACE`, `TBD`, `FIXME`, …), empty vocabulary meanings/definitions,
empty or headings-only transcripts, transcripts longer than 50 000
characters.

Warnings (never block): Persian title > 60 chars, English title > 60
chars, Persian description < 40 chars, transcript < 1000 chars, missing
example sentence, missing phonetic, no vocabulary on a Variant, generic
artwork alt text, non-square artwork (±8 px), artwork < 512 px, hero not
landscape, hero far from 16:9, repeated title words, > 20 vocabulary
entries.

The validator never judges writing style and never uses AI. It only
checks explicit thresholds.

## Audio requirements

- MP3 or M4A; ≤ 10 MB per Variant; ≤ 2 MB for pronunciation clips.
- The duration is **extracted from the file** (locally and again
  server-side) — never typed by hand, never taken from the manifest.
- The same audio file must not be reused by two Variants.

## Version rules

| Situation                                        | Result                                    |
| ------------------------------------------------ | ----------------------------------------- |
| New `contentKey`                                 | Creates the Episode + Variants as Draft   |
| Same key, same version, same fingerprint         | `no_change` — nothing written             |
| Same key, same version, different fingerprint    | `conflict` — increment `contentVersion`   |
| Same key, higher version                         | Update into Draft (published → Draft)     |
| Same key, lower version                          | `stale` — rejected                        |

A higher-version import moves the Episode **and all of its Variants** to
Draft so the live published experience is never silently overwritten;
you publish later from the Admin Console. Existing Student Progress is
never touched. Failed attempts never block a corrected re-import.

## Errors and fixes

| Message | Fix |
| --- | --- |
| `PLACEHOLDER_VALUE` | Replace `TODO_REPLACE` values with real copy. |
| `PACKAGE_PATH_UNSAFE` / `PACKAGE_PATH_ESCAPE` | Fix the asset path; keep everything inside the package. |
| `MANIFEST_INVALID_JSON` | `episode.json` is not valid JSON. |
| `CONTENT_KEY_MISMATCH` | `contentKey` must be `<categoryKey>.<slug>`. |
| `ASSET_MISSING` | Upload every file the manifest references. |
| `AUDIO_DURATION_UNREADABLE` | The audio file is not a readable MP3/M4A. |
| `import_conflict` | Same version, different files — bump `contentVersion`. |
| `import_stale` | Your `contentVersion` is lower than the stored one. |
| `category_not_found` | Create the Category first (superuser tooling). |
| `plan_stale` | The database changed since your plan — re-run `content:plan`. |

## Security model

- The CLI authenticates as `staff_admins`
  (`FEP_PB_URL`, `FEP_STAFF_EMAIL`, `FEP_STAFF_PASSWORD`). No
  superuser credentials, no printed passwords or tokens.
- The server re-validates everything (identity, paths, file types,
  sizes, durations, versions) — the CLI's local validation is never the
  security boundary.
- Imported content is Draft and hidden from every public Student route
  until an explicit later Publish.
- Every attempt is recorded in the `content_imports` audit collection
  (Staff-only routes); diagnostics are bounded and sanitized.
