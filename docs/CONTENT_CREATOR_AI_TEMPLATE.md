# Fast English Podcast — Content-Creator AI Template

**Purpose:** One reusable, human-friendly file you copy or attach to any capable external AI whenever you want to create a new Fast English Podcast Episode. The AI researches the topic, writes six level-adapted transcripts and all supporting assets, and returns a **machine-import package** that conforms exactly to the repository's current content-package schema — ready for you to review, generate media, Validate → Dry Run → Confirm → Import as Draft → Preview → Publish through the existing pipeline.

**Audience:** An external AI with no codebase access. This file gives it enough product, editorial, and schema context to produce excellent Fast English content without you pasting the repo.

**Ground rule for the AI:** The repository's real schema is the contract. Do not invent a parallel JSON format, rename fields, duplicate validation, or change the import pipeline to make the task easier. When in doubt, be faithful to the schema, not clever.

---

## 0. How to use this file

1. Fill the **INPUT FORM** at the bottom (§15) — you only need Topic + a few optional inputs.
2. Copy **this entire file** + the completed INPUT FORM and send both to the external AI.
3. The AI returns its work in the **OUTPUT ORDER** defined in §14 — human-readable editorial sections first, machine-readable package last.
4. You review, request edits, generate artwork/audio assets, then run the repository's own validation and import:
   ```bash
   pnpm content:new <episode-slug> --levels A1,A2,B1,B2,C1,C2  # or the levels you chose
   # copy the AI's transcripts/vocab/manifest into the generated directory, add media
   pnpm content:validate content-packages/<episode-slug>
   pnpm content:plan     content-packages/<episode-slug>
   pnpm content:import   content-packages/<episode-slug>        # explicit Confirm required
   # Import lands as Draft — Preview in Admin Content Studio, then Publish.
   ```

> **Do not edit the 13 workflow steps or quality rules below when reusing the file.** Only the INPUT FORM changes per Episode.

---

## 1. Product context (the model you must preserve)

```
Category
  → canonical Episode  (topics)
    → level-specific Variant per CEFR level  (lessons) — one of A1 / A2 / B1 / B2 / C1 / C2
      → per-Variant vocabulary  (lesson_vocabulary)
      → per-Variant audio / transcript / progress (progress is never created by the pipeline)
```

* One **Category** contains many Episodes. The pipeline **never creates Categories** — `categoryKey` must already exist in the database. Use `general` unless INPUT says otherwise.
* One **Episode** is one story/topic (slug, English/Persian titles, Persian description, one square artwork + optional hero, alt text, optional episodeNumber/featured). It is shared across levels.
* Each **Variant** is the same Episode retold at one CEFR level. **Do not write six unrelated stories.**
* **Entitlement is not level-gated:** an active subscribed student may access any published Variant. Level is pedagogical, not authorization.
* Imports are **always Draft**. Nothing is published by the pipeline. Publishing is a later explicit action in Admin Content Studio.

---

## 2. Package contract — the exact schema that must be emitted

**Schema file (authoritative):** `schemas/episode-package.schema.json` (JSON Schema draft 2020-12, `additionalProperties: false` at every level — unknown fields are rejected).

**Committed examples (reuse, do not duplicate manually):**

* `content-packages/example-episode/` — two-variant example (B1 + C1)
* `content-packages/typical-workday-sample/` — single-variant public-sample demo (B1)
* `content-packages/README.md` + `docs/CONTENT_PIPELINE.md` — directory contract, CLI, and version rules
* `schemas/episode-package.schema.json` — the full machine contract; the only supported `schemaVersion` is `"1.0.0"`

**Blank template (preferred machine starting point):** do not hand-write `episode.json` from scratch. Generate it with the repository's own tool:

```bash
pnpm content:new <episode-slug> --levels A1,A2,B1,B2,C1,C2
```

The generator creates `episode.json` with `TODO_REPLACE` placeholders that **intentionally fail validation** until you replace them with real copy and assets. Reference that generator in your output; never invent a parallel template.

### Manifest shape (summary — see schema for exact constraints)

```json
{
  "$schema": "../../schemas/episode-package.schema.json",
  "schemaVersion": "1.0.0",
  "contentKey": "<categoryKey>.<episode.slug>",
  "contentVersion": 1,
  "categoryKey": "general",
  "episode": {
    "slug": "my-episode-slug",
    "titleEn": "...",
    "titleFa": "...",
    "descriptionFa": "...",
    "artworkSquare": "artwork/square.png",
    "heroImageWide": "artwork/hero.png",
    "artworkAltFa": "...",
    "episodeNumber": 1,
    "featured": false
  },
  "variants": [
    {
      "level": "B1",
      "summaryFa": "...",
      "audio": "audio/b1.mp3",
      "transcript": "transcripts/b1.md",
      "vocabulary": [
        {
          "term": "word or phrase",
          "phonetic": "/.../",
          "partOfSpeech": "noun",
          "meaningFa": "...",
          "definitionEn": "...",
          "exampleSentence": "...",
          "pronunciationAudio": "audio/pronunciation/term.mp3"
        }
      ]
    }
  ]
}
```

### Hard rules

| Rule | Value |
|---|---|
| `schemaVersion` | `"1.0.0"` only |
| `contentKey` | must equal `"<categoryKey>.<episode.slug>"`, pattern `^[a-z0-9][a-z0-9._-]*$` (3–160 chars) |
| `contentVersion` | integer 1–100000; bump to update; same version + different fingerprint → `conflict` |
| `categoryKey` | `^[a-z0-9][a-z0-9_-]*$` (1–80 chars); pipeline never creates Categories — typo is a hard error |
| `episode.slug` | `^[a-z0-9]+(?:-[a-z0-9]+)*$` (2–120 chars) |
| `episode.titleEn` | 1–120 chars (warning >60) |
| `episode.titleFa` | 1–200 chars (warning >60) |
| `episode.descriptionFa` | 1–2000 chars (warning <40) |
| `episode.artworkSquare` | required; safe relative path (see below); JPEG/PNG/WebP, ≤5 MB |
| `episode.heroImageWide` | optional; same type/size; landscape recommended |
| `episode.artworkAltFa` | required (1–500 chars) |
| `variants` | 1–6 items, CEFR levels `A1…C2` unique |
| `variant.summaryFa` | required, 1–500 chars |
| `variant.audio` | required; safe relative path, single `audio/<level>.mp3` per Variant; MP3/M4A only; ≤10 MB; duration extracted from bytes (never hand-typed) |
| `variant.transcript` | required; safe relative path, single `transcripts/<level>.md` per Variant; UTF-8 Markdown; ≤50000 chars; no `<script>/<iframe>/<object>/<embed>`, no `javascript:` links; not empty, not headings-only |
| `vocabulary` | 0–100 per Variant (warning >20); each entry: `term` (required), `meaningFa` (required), `definitionEn` (required), optional `phonetic` (≤200), `partOfSpeech` (≤50), `exampleSentence` (≤1000), `pronunciationAudio` (≤200, MP3/M4A, ≤2 MB) |
| Unknown properties | rejected everywhere (`additionalProperties: false`) |
| Duplicates | duplicate Variant `level` or duplicate normalized vocabulary `term` (trim → collapse whitespace → lowercase) → blocking error |
| Assets | files only, never Base64; same audio file cannot be reused by two Variants |
| `episodeNumber` / `featured` | optional |

### Safe path rule (mirrors the pipeline and server)

A manifest asset path must not contain `..`, `.`, empty segments, leading `/`, drive prefixes (`C:`), UNC (`//`), backslashes, null bytes, or encoded traversal (`%2e%2e`). It must match `^[A-Za-z0-9][A-Za-z0-9._/-]*$` (≤200 chars) and must resolve inside the package root — symlinks pointing outside are rejected at validation and server-side.

### Directory contract

```
content-packages/<episode-slug>/
├── episode.json              ← manifest (references paths below)
├── README.md                 ← editor notes (optional)
├── artwork/
│   ├── square.png|jpg|webp   ← required (≤5 MB, square ±8px, ≥512px recommended)
│   └── hero.png|jpg|webp     ← optional (≤5 MB, landscape, ratio ideally 1.4–2.1)
├── audio/
│   ├── a1.mp3|m4a            ← one per Variant (≤10 MB, MP3/M4A, duration from bytes)
│   ├── a2.mp3|m4a
│   ├── b1.mp3|m4a
│   ├── b2.mp3|m4a
│   ├── c1.mp3|m4a
│   ├── c2.mp3|m4a
│   └── pronunciation/
│       └── <term>.mp3        ← optional per-word clips (≤2 MB each, MP3/M4A)
└── transcripts/
    ├── a1.md
    ├── a2.md
    ├── b1.md
    ├── b2.md
    ├── c1.md
    └── c2.md
```

**Conventional filenames (use these so Validate/Dry-Run/Import need no special mapping):**

* Artwork: `artwork/square.png` (or `.jpg/.webp`), hero `artwork/hero.png`
* Audio: `audio/<lowercase-level>.mp3` (e.g. `audio/b1.mp3`) — one distinct file per Variant
* Transcripts: `transcripts/<lowercase-level>.md`
* Pronunciation: `audio/pronunciation/<normalized-term>.mp3` (lowercase, words joined with `-`, e.g. `take-care-of.mp3`)

---

## 3. INPUT — fill this for each new Episode

> The human fills only this section (the rest of the file is the standing instruction for the AI). Copy the **INPUT FORM** from §15, fill it, and send it with this file.

For the AI: treat INPUT as authoritative and do not infer missing values. If INPUT says "suggest a category", propose one `categoryKey` from the known set (`general` is the safe default — note that non-`general` keys must already exist or the import will fail with `category_not_found`). If INPUT says "all six levels" is false, produce only the requested levels.

| Field | What to provide |
|---|---|
| **Topic / idea** | One-line topic (required) |
| **Category** | Existing `categoryKey` (e.g. `general`) or the literal `"suggest a category"` |
| **Source/reference material** | URLs, documents, or brief notes you already have — or `"none"` |
| **Desired Episode angle** | One sentence on the editorial angle (e.g. "history for curious beginners" vs "practical travel tips") |
| **Levels** | `"all six"` (A1–C2) or a comma list like `A1,B1,B2` — the AI must not add unrequested levels |
| **Target duration** | e.g. `4 minutes`, `"default"`, or a per-level override — clearly an estimate until real audio is measured |
| **Must-include facts/phrases** | Exact facts or phrases that must appear (or `"none"`) |
| **Must-avoid facts/claims** | Facts, claims, or phrases that must NOT appear (or `"none"`) — also constraints like "no political commentary" |
| **Preferred English accent** | e.g. `American`, `British (RP)`, `neutral` — determines pronunciation guidance and audio direction, not transcript spelling (use natural English unless the angle requires otherwise) |
| **Artwork constraints** | Palette, mood, subject limits, or `"none"` — never supply text/logos/brands/real-person likenesses unless legally appropriate |
| **Source-of-truth language** | Whether factual claims must cite authoritative sources in the editorial notes (recommended for news/science/law/health/tech/people/companies) |

---

## 4. Editorial workflow — follow exactly, in order

The AI must execute these 13 steps and leave evidence of each in its output. Do not skip or reorder.

1. **Understand and research the topic.** Read INPUT and any source material. If the topic involves current facts, news, statistics, science, law, health, technology, people, companies, products, or other changing information, research authoritative/current sources **before** writing. Never invent citations, statistics, quotations, biographies, dates, research findings, or factual details.
2. **Establish a single canonical Episode concept** before writing any level. One sentence: what is this Episode about and what is its take?
3. **Build a factual "source-of-truth" note** for the Episode: every name, date, number, claim, and definition you will rely on, each traceable to either INPUT or a named authoritative source. This note is not imported — it is your internal contract.
4. **Decide what information survives across every CEFR Variant.** List the 5–9 core facts that must appear at every level (names, chronology, key numbers, outcome, conclusion). These are the cross-level invariants.
5. **Adapt language complexity rather than creating six unrelated stories.** Keep the same narrative, evidence, and conclusion across levels; vary lexical range, sentence structure, density, discourse, and abstraction — not the story.
6. **Produce all Variant transcripts** (one `transcripts/<level>.md` each). Each must be audio-ready (see §6).
7. **Produce Persian summaries** based on the **actual corresponding Variant** (`summaryFa` ≤500 chars). One per Variant; no facts absent from the Variant; no learning-guarantee claims.
8. **Select genuinely useful vocabulary** from each Variant (see §8).
9. **Prepare pronunciation content** for the selected vocabulary (see §9).
10. **Prepare narration/audio-production scripts** (see §10).
11. **Prepare artwork direction and prompts** at the Episode level (see §11).
12. **Perform cross-level consistency and educational QA** (see §12).
13. **Produce the final data/assets manifest** according to the schema in §2 — with an explicit asset checklist marking every binary asset as `TO GENERATE` or `EXISTS`.

---

## 5. CEFR guidance — the same Episode, six tellings

### Invariants across A1–C2

* Core facts, names, numbers, chronology, and conclusion remain **identical**.
* Language complexity, sentence structure, lexical range, nuance, density, discourse structure, and abstraction may increase naturally.
* Upper levels may add relevant nuance and supporting context but must **not contradict or silently change** the canonical story.
* Simplification must **never turn a true claim into a false or misleading one**.
* Do **not** mechanically replace words with "harder synonyms".
* Every level should sound like natural English written for a real listener at that level. CEFR is pedagogical guidance, not a claim of official certification.
* Treat B1 as an especially strong "default" listening version.

### Practical CEFR progression

**A1**
Highly concrete language; short sentences; common high-frequency vocabulary; simple present/past where appropriate; limited clause complexity; explicit references rather than ambiguous pronouns; avoid idioms, phrasal density, abstraction, and uncommon synonyms. *But not infantilized — Fast English is an adult product; even A1 should feel respectful, contemporary, and interesting.*

**A2**
Still concrete and accessible; modestly longer sentences; common connectors (`because`, `so`, `but`, `when`, `if`); basic past/future and everyday descriptive language; limited subordinate clauses where natural.

**B1**
Natural intermediate podcast English; wider everyday vocabulary; connected paragraphs; cause/effect, explanation, and comparison; moderate sentence variation. **This should be an especially strong default listening version.**

**B2**
More natural native-like discourse without becoming academic; richer vocabulary and collocations; more nuanced explanation; more complex clause structures; comfortable use of inference, contrast, and qualification.

**C1**
Sophisticated but listenable; precise lexical choice; idiomatic language where genuinely natural; nuanced argument and context; flexible sentence structures; no artificial thesaurus writing.

**C2**
Fully natural advanced English; subtle distinctions, rhetorical control, and precise expression. Complexity must come from ideas and language control, not obscure vocabulary for its own sake. Remains suitable for spoken podcast narration.

### Voice (all levels)

**Should sound:** clear, engaging, adult, credible, warm, editorial, podcast-native, concise, non-academic unless the topic requires it, non-childish, non-salesy.

**Avoid:** textbook filler; fake motivational language; excessive introductions; "In today's lesson we are going to…"; repetitive conclusions; AI-sounding rhetorical padding; unnecessary headings inside the spoken transcript; fabricated anecdotes; overuse of rhetorical questions; generic moral lessons; claims about guaranteed language improvement.

---

## 6. Transcripts — audio-ready

Each `transcripts/<level>.md` must:

* Sound good when read aloud and use natural spoken punctuation.
* Avoid Markdown formatting inside the spoken copy (no headings, no bold/italic markup — plain flowing paragraphs; afsplit paragraphs with a single blank line).
* Avoid URLs, citation syntax, footnote markers, and visual-only notation.
* Write numbers/dates in a form that will be pronounced naturally (e.g. "nineteen ninety-eight", "about three hundred", "twenty-first of March, twenty twenty-four").
* Avoid excessively long sentences that are difficult to narrate.
* Preserve sensible paragraph breaks (the pipeline collapses 3+ blank lines to one; CRLF is normalized — meaning and paragraph rhythm are preserved).
* Not contain stage directions unless the schema explicitly supports them (it does not).
* Be between a few hundred characters and 50000 chars. The editor warns when a transcript is <1000 chars (not a block), but aim for the target duration in INPUT (rough guide: ~130–150 words per minute of narration).

---

## 7. Persian summaries

For every Variant, produce `summaryFa` (≤500 chars):

* Explain the **actual Episode** clearly and concisely in natural contemporary Persian.
* Help comprehension rather than translating every sentence.
* Do not introduce facts absent from the Variant transcript.
* Do not contain exaggerated learning claims ("you will master…").
* Base it on the **corresponding Variant** — an A1 summary reflects the A1 narrative, not the C1 nuance.

---

## 8. Vocabulary

For every Variant, create a curated `vocabulary` list from **that Variant's own transcript**.

Use the existing `lesson_vocabulary` fields:

| Field | Required | Guidance |
|---|---|---|
| `term` | yes | The word/expression as it appears in the transcript (preserve original case/display) |
| `meaningFa` | yes | Contextual Persian meaning (not a dictionary dump) |
| `definitionEn` | yes | Simple, accurate English definition that fits the meaning used in this Episode |
| `phonetic` | no | IPA where helpful (strongly recommended — the editor warns when missing) |
| `partOfSpeech` | no | e.g. `noun`, `verb`, `adjective`, `phrasal verb`, `collocation` (text, not a pill) |
| `exampleSentence` | no | Original, natural sentence at approximately the same CEFR level |
| `pronunciationAudio` | no | Package-relative path like `audio/pronunciation/<term>.mp3` (≤2 MB, MP3/M4A) |

**Rules:**

* Choose genuinely useful words, phrases, phrasal verbs, or collocations that materially help a learner understand this Episode. Prioritize pedagogical value over quantity.
* Do not select trivial words merely to reach a quota.
* Do not select terms that do not appear in the Variant unless the INPUT explicitly approves supplementary vocabulary (the product prefers in-transcript terms).
* Definitions must fit the sense used in the transcript.
* Example sentences should be original, natural, and comprehensible at approximately the same CEFR level.
* Persian meanings should reflect contextual sense.
* Avoid duplicate normalized terms (the import rejects case/whitespace-insensitive duplicates).
* Stay within the server vocabulary limit (≤100 per Variant; keep ≤20 to avoid editorial warnings unless genuinely justified — quality over quantity).

---

## 9. Pronunciation preparation

When `pronunciationAudio` is declared, it must resolve to a real MP3/M4A file (≤2 MB) at the declared path. The pipeline verifies existence, type, and duration — a reference without a file is a blocking error (`ASSET_MISSING`) at both local validation and server-side import.

For the AI's output:

* List the exact `term` that should be spoken.
* Provide a **deterministic filename suggestion** consistent with the repo conventions: `audio/pronunciation/<normalized-term>.mp3` where normalized-term is lowercase with words joined by `-` (e.g. `"take care of"` → `take-care-of.mp3`).
* Clearly distinguish **generated-asset requirements** (files that must be produced, e.g. via TTS or studio recording) from already-existing assets — do not pretend a file exists before it is generated.
* Where a word has a genuinely ambiguous pronunciation, add a brief phonetic/pronunciation note (e.g. stress, vowel) in the audio manifest, not in the transcript.

---

## 10. Audio production — per Variant

For every requested CEFR level, produce:

* **Final narration transcript** (the `transcripts/<level>.md` content).
* **Suggested narration pace** appropriate to the level: A1/A2 slightly slower, B1 natural, B2+ natural-native (never classroom-exaggerated for the main Episode).
* **Pronunciation notes** only where genuinely needed (names, proper nouns, technical terms requiring special care).
* **Intended accent** if provided in INPUT; otherwise `"neutral"` — record it explicitly.
* **Proposed audio filename** using the repo convention: `audio/<level>.mp3` (lowercase level, e.g. `audio/b1.mp3`; `.m4a` is also accepted but `.mp3` is preferred for compatibility).
* **Estimated duration** derived from the final transcript word count (clearly labelled as an **estimate** until the real audio file is measured — the pipeline extracts `audio_duration_seconds` from the bytes and derives `estimated_minutes` server-side; manifest estimates must never be treated as authoritative).

**Production guidance (podcast-first):**

* Natural human pacing; short pauses between meaningful paragraphs.
* No classroom-style exaggerated pronunciation for the main Episode.
* No background music unless INPUT explicitly requests it.
* No baked-in intro/outro unless it is part of the approved Fast English audio identity (it is not — the Episode is the content).
* Consistent loudness and recording character across levels.
* One distinct audio file per Variant; never reuse the same file for two levels.

---

## 11. Artwork direction — one identity shared across Variants

Produce a single **Episode-level** art direction (not six unrelated covers). Variants share one recognizable visual identity.

Provide:

* **Concise art direction** — one sentence.
* **Primary concept** — what the image is about.
* **Visual subject** — what is depicted.
* **Composition** — framing, focal point, negative space (remember: the image reads at thumbnail size).
* **Mood** — calm, editorial, contemporary (Fast English is not stock-photo or childish).
* **What to avoid.**
* **One production-ready image-generation prompt for the square artwork** (1:1, for `artwork/square.png`).
* **A wide/hero adaptation prompt** only if `heroImageWide` is being produced (landscape, ~16:9, for `artwork/hero.png`). Omit the hero if INPUT does not request it — the field is optional.

**Prompt constraints:**

* Do not invent logos, text, certifications, brands, copyrighted characters, or real-person likenesses unless explicitly supplied and legally appropriate.
* Prefer strong editorial podcast artwork over generic stock-photo aesthetics.
* Artwork must remain legible and useful at thumbnail size; do not rely on tiny text.
* Technical: square ±8px, recommended minimum 512 px; hero landscape, ratio ideally 1.4–2.1; ≤5 MB each; JPEG/PNG/WebP.

---

## 12. QA — the AI must check before final output

The AI must run these checks and report pass/fail in item 13 of the OUTPUT ORDER (§14.13) in its response.

### Factual consistency

* All requested levels describe the same real Episode; names, dates, quantities, and facts agree.
* No unsupported claim was introduced during simplification.

### CEFR differentiation

* A1 and C2 are meaningfully different.
* Adjacent levels progress naturally.
* Complexity is not created only through synonym replacement.
* No level becomes unnaturally difficult or childish.

### Audio readiness

* Transcripts are speakable; paragraph rhythm is sensible.
* No citation markup or visual-only notation appears in narration.
* Proper-noun pronunciation notes exist where needed.

### Vocabulary quality

* Every selected item is pedagogically useful and appears in the Variant.
* Contextual meanings, definitions, and examples are accurate.
* No duplicate normalized terms; limits respected (≤100, ideally ≤20).

### Cross-asset consistency

* Filenames/references agree with the final manifest.
* Audio references correspond to the correct Variant; vocabulary pronunciation references correspond to the correct word; artwork references are Episode-level; no A1 asset is accidentally referenced by B1, etc.

### Package validity

* Exact current schema is respected; required fields exist; unsupported fields are not invented.
* No absolute local filesystem paths; no secrets/tokens; no publication bypass; generated imports remain Draft.
* `contentKey` equals `<categoryKey>.<episode.slug>`; no duplicate levels; no `additionalProperties` violations.

---

## 13. Most important — separate CONTENT CREATION from PACKAGE SERIALIZATION

The AI's **human-readable authoring sections** (§14, items 1–13) may contain richer editorial notes, source notes, QA notes, audio instructions, and artwork prompts.

The **machine-import package** (§14, items 14–16 and the final JSON) must contain **only fields/files allowed by the repository schema** (see §2). Do not force editorial-only metadata (research notes, QA reports, duration estimates, art prompts, accent preferences) into production records if the schema does not support it. Those notes stay in the human-readable sections.

---

## 14. OUTPUT ORDER — the AI must return its work in this order

The AI's response must be a single document that follows these 16 numbered sections. Sections 1–13 are human-readable; 14–16 are machine-facing. Keep the headings exactly as numbered so the human can scan quickly.

1. **Editorial Brief** — one-paragraph framing: what is this Episode, why does it matter, and what is the editorial take.
2. **Research / Factual Source Notes** — authoritative sources consulted (or "no external sources required — topic is not time-sensitive factual"), key facts extracted, and any facts deliberately excluded per INPUT.
3. **Canonical Episode Identity** — slug, English/Persian titles, Persian description, categoryKey, contentKey, contentVersion, episodeNumber/featured if any — the single Episode concept before level adaptation.
4. **A1 Variant** — Level, Title, Persian Summary, Narration Transcript (full), Approximate word count, Estimated narration duration (labelled as estimate), Key Vocabulary table, Pronunciation asset requirements, Audio asset requirement, Variant-specific QA notes.
5. **A2 Variant** — (same shape as A1; omit entirely if A2 was not requested in INPUT).
6. **B1 Variant** — (same shape; B1 should be the strongest default version — give it extra care).
7. **B2 Variant** — (same shape).
8. **C1 Variant** — (same shape).
9. **C2 Variant** — (same shape).
10. **Cross-Level Vocabulary Review** — one table/section noting overlaps, intentional level-specific differences, and any duplicate-term risks avoided.
11. **Audio Production Manifest** — one row per requested Variant: audio file, accent, pace, estimated duration (marked estimate), pronunciation note count, and a clear `TO GENERATE` flag per file.
12. **Artwork Direction + Generation Prompt** — Episode-level direction, square prompt, hero prompt if any, constraints applied, and the expected output files (`artwork/square.png`, optionally `artwork/hero.png`).
13. **Content QA Report** — pass/fail per checklist in §12, with a short note on every check; any failure must block the package until fixed.
14. **Final Import Package Manifest** — a table summarizing the exact manifest fields and every referenced path relative to the package root (no absolute paths, no truncated lists).
15. **Final machine-readable package content using the EXACT schema** — the complete `episode.json` JSON block (valid JSON, with the `$schema` reference `../../schemas/episode-package.schema.json`, `schemaVersion "1.0.0"`, and every `audio`/`transcript`/`artwork*`/`pronunciationAudio` pointing to a package-relative file). Surround with ```json fences so it can be copied. This is the only JSON the import consumes.
16. **Asset Checklist** — every binary asset the package needs, explicitly marking `TO GENERATE` (media the human must still produce) vs `EXISTS` (provided fixtures). Never claim generation is done when it is not. All rows must have a package-relative path, kind, and expected format.

### Per-Variant human-readable section — minimum required rows

For each requested level show at least:

* **Level** — e.g. `B1` (CEFR enum)
* **Title** — the Variant shares the Episode's titles; repeat them so the section is self-contained (do not add a Variant-specific title field — the schema has none)
* **Persian Summary** — `summaryFa` (≤500 chars, based on this Variant)
* **Narration Transcript** — full speakable text (the `transcripts/<level>.md` content)
* **Approximate word count** — integer
* **Estimated narration duration** — e.g. `~2:40` with an explicit "(estimate until real audio is measured)"
* **Key Vocabulary** — table of that Variant's entries (term, phonetic, part of speech, meaningFa, definitionEn, exampleSentence, pronunciationAudio path if any)
* **Pronunciation asset requirements** — list of `pronunciationAudio` paths and whether each is `TO GENERATE`
* **Audio asset requirement** — single file path for the Variant (e.g. `audio/b1.mp3`, MP3/M4A, ≤10 MB, `TO GENERATE` until recorded)
* **Variant-specific QA notes** — one line: transcript speakability, vocabulary pedagogical relevance, and any level-specific nuance added vs the source-of-truth

Do not turn estimated metrics (word count, estimated duration, pace) into authoritative imported metadata — the application derives real duration from the uploaded audio.

---

## 15. INPUT FORM — copy, fill, and send with this file

> Fill every line. Write `"none"` or `"default"` rather than leaving blanks. The AI must not hallucinate missing inputs.

```
TOPIC:
CATEGORY:                        # existing categoryKey (e.g. general) or "suggest a category"
ANGLE:                           # one sentence editorial angle, or "suggest an angle"
SOURCE MATERIAL:                 # URLs/notes or "none"
MUST-INCLUDE FACTS:             # exact facts/phrases that must appear, or "none"
MUST-AVOID:                     # facts/phrases/claims that must not appear, or "none"
LEVELS:                          # "all six" or comma list like "A1,B1,C1" — must match contentKey expectations
TARGET DURATION:                # e.g. "4 minutes", "default (~2-4 min)", or per-level like "A1 ~2 min, C1 ~5 min"
ENGLISH ACCENT:                 # e.g. "American", "British (RP)", "neutral" — or "default"
ARTWORK NOTES:                  # constraints/palette/mood or "none"
OTHER NOTES:                    # anything else — or "none"
```

**Adaptor note:** if you leave CATEGORY as `"suggest a category"`, the AI should propose the best `categoryKey` and flag that importing will fail until that Category exists (the pipeline never creates Categories — create it first via superuser tooling/Admin).

---

## 16. Worked example — how to fill INPUT and what the output structure looks like

This example exists only to teach usage. It is not a production Episode and does not include six full transcripts (that would hide the structure). Do not copy its content verbatim for a real Episode.

### 16a. Filled INPUT FORM (example)

```
TOPIC: Why honey bees matter for food and farming
CATEGORY: general
ANGLE: Explain the role of honey bees in pollination for a curious adult listener, focusing on everyday food rather than dense biology.
SOURCE MATERIAL: none
MUST-INCLUDE FACTS: Bees pollinate about one third of the food we eat; colony collapse has multiple causes, not one single cause.
MUST-AVOID: Do not claim bees make honey specifically for humans; do not give pesticide brand names or medical dosage advice.
LEVELS: B1,B2,C1
TARGET DURATION: default (~3 minutes per Variant)
ENGLISH ACCENT: neutral (clear international English)
ARTWORK NOTES: warm, natural editorial cover — a honey bee on a simple flower, no text, no beekeeper portrait, no product logo
OTHER NOTES: none
```

### 16b. What the AI's response structure would look like (condensed — not the full Episode)

> The AI would expand each section in full; the sketch below shows the shape so the human knows what to expect. All 16 output items are sketched, but only items 14–16 include realistic file-path / JSON detail because those are the serialization boundary.

```markdown
1. Editorial Brief
   This Episode explains why honey bees matter for everyday food. The angle is practical and adult — what pollination
   means for fruit and vegetables, why colonies have weakened, and what ordinary people can do.

2. Research / Factual Source Notes
   - Consulted: FAO pollination summary, peer-reviewed review on colony-collapse drivers (2023–2024).
   - Key facts retained: pollination of ~1/3 of food crops; multi-factor colony stress (habitat, pesticides, disease).
   - Excluded per INPUT: honey-as-human-product narrative, pesticide brand advice.

3. Canonical Episode Identity
   - slug: why-honey-bees-matter
   - titleEn: Why Honey Bees Matter
   - titleFa: چرا زنبورهای عسل مهم هستند
   - descriptionFa: روایتی کوتاه درباره نقش زنبور عسل در گردهافشانی مواد غذایی روزمره...
   - categoryKey: general
   - contentKey: general.why-honey-bees-matter
   - contentVersion: 1

4–9. Variants (one section per requested level)
   [Each would contain: Level / Title / summaryFa / full transcript / word count / estimated duration /
    vocabulary table / pronunciation list / audio requirement / QA note]

10. Cross-Level Vocabulary Review
    B1 avoids "monoculture" where B2 keeps it with a gloss; "pollinate" appears at all levels.

11. Audio Production Manifest
    | Variant | Audio file      | Accent  | Pace   | Est. duration | Status      |
    |---------|---------------|---------|--------|---------------|-------------|
    | B1      | audio/b1.mp3    | neutral | natural | ~2:50         | TO GENERATE |
    | B2      | audio/b2.mp3    | neutral | natural | ~3:10         | TO GENERATE |
    | C1      | audio/c1.mp3    | neutral | natural | ~3:30         | TO GENERATE |

12. Artwork Direction + Generation Prompt
    Direction: Close editorial crop of a single honey bee on a pale background wildflower — calm, warm, contemporary.
    Square prompt: "editorial podcast cover, single honey bee in sharp focus on a soft pale flower, warm natural light,
    generous negative space, minimal and contemporary, square composition, no text, no logos — photographic, not stock-photo"
    Hero: not requested for this input (optional `heroImageWide` omitted) — if a hero were requested, reuse the same concept with a wider landscape field.

13. Content QA Report
    Factual consistency: PASS — B1/B2/C1 share the same pollination statistic and multi-cause explanation.
    CEFR differentiation: PASS — B1 short paragraphs with common connectors; C1 adds qualification and collocations.
    …

14. Final Import Package Manifest
    episode.json → schemas/episode-package.schema.json v1.0.0, contentKey general.why-honey-bees-matter, version 1

15. Final machine-readable package content  (the importable JSON — shortened here for illustration)
```

```json
{
  "$schema": "../../schemas/episode-package.schema.json",
  "schemaVersion": "1.0.0",
  "contentKey": "general.why-honey-bees-matter",
  "contentVersion": 1,
  "categoryKey": "general",
  "episode": {
    "slug": "why-honey-bees-matter",
    "titleEn": "Why Honey Bees Matter",
    "titleFa": "چرا زنبورهای عسل مهم هستند",
    "descriptionFa": "روایتی کوتاه و دقیق درباره نقش زنبور عسل در گردهافشانی مواد غذایی روزمره و دلایل آسیبپذیری کلونیها.",
    "artworkSquare": "artwork/square.png",
    "artworkAltFa": "زنبور عسل روی گلی روشن در نور طبیعی"
  },
  "variants": [
    {
      "level": "B1",
      "summaryFa": "در این اپیزود میشنوید زنبورهای عسل چگونه به تولید میوهها و سبزیجات کمک میکنند.",
      "audio": "audio/b1.mp3",
      "transcript": "transcripts/b1.md",
      "vocabulary": [
        {
          "term": "pollinate",
          "phonetic": "/ˈpɒlɪneɪt/",
          "partOfSpeech": "verb",
          "meaningFa": "گردهافشانی کردن",
          "definitionEn": "To carry pollen from one flower to another so that it can produce seeds or fruit.",
          "exampleSentence": "Bees pollinate many of the foods we eat every day.",
          "pronunciationAudio": "audio/pronunciation/pollinate.mp3"
        }
      ]
    }
  ]
}
```

```markdown
16. Asset Checklist
    | Path                                   | Kind               | Format      | Size limit | Status      |
    |----------------------------------------|--------------------|------------|-----------|-------------|
    | artwork/square.png                     | artworkSquare      | PNG/JPG/WEBP | ≤5 MB    | TO GENERATE |
    | audio/b1.mp3                           | audio              | MP3/M4A    | ≤10 MB    | TO GENERATE |
    | transcripts/b1.md                      | transcript         | Markdown   | ≤50000 chars | EXISTS   |
    | audio/pronunciation/pollinate.mp3      | pronunciationAudio | MP3/M4A    | ≤2 MB     | TO GENERATE |
```

This is intentionally small — a real package would cover all requested levels and include full transcripts, vocabulary, and pronunciation tables per Variant, but the **shape** above is exactly what you should receive.

---

## 17. Anti-patterns — the AI must never

* Invent a new JSON schema, rename `contentKey`/`categoryKey`/`episode`/`variants`/`summaryFa`/`pronunciationAudio`, or add fields like `duration`/`language`/`author` that the schema rejects.
* Embed artwork or audio as Base64.
* Use absolute local filesystem paths, secrets, tokens, or localhost URLs.
* Fabricate authoritative duration, citations, statistics, quotations, or publication dates.
* Turn editorial notes (source-of-truth, QA, pace, art prompt) into manifest fields.
* Reuse the same `audio/<level>.mp3` for two Variants.
* Introduce facts absent from the source-of-truth in any level's summary or transcript.
* Introduce generic alt text like `"artwork"` or leave placeholders (`TODO_REPLACE`, `TBD`, `FIXME`, `PLACEHOLDER`, `lorem ipsum`, `«بهزودی»`, `XXX`).
* Auto-publish — the target is always `draft`.

---

## 18. Validation & import — what happens after the AI

The AI's JSON is not trusted by the server. Every field, path, file type, size, signature, and duration is re-validated server-side; unauthorized callers and inactive Staff are rejected; draft content stays hidden from Student routes. The human's job is to:

1. Run `pnpm content:validate` — finds and reports schema/asset/editorial errors locally before touching the server.
2. Run `pnpm content:plan` (`--json` is available for tooling) — shows the deterministic diff and the `planStateHash`. The plan never mutates the database.
3. Review the plan. The human confirms explicitly — `content:import` asks for `import` typed in an interactive terminal (or `--yes` for automation). Direct execution without a plan is rejected (`400 plan_state_required`).
4. Import — one multipart request carrying manifest + bytes to `POST /api/fast-english/staff/content-import/execute` with `?planStateHash=`; the server runs the whole import in one transaction. A stale plan (database changed since `plan`) → `409 plan_stale` → re-plan and reconfirm.
5. Preview as Draft in Admin Content Studio (private staff-only routes; Range-supported audio, private `no-store`).
6. Publish explicitly in Admin Content Studio when ready. Existing Student progress is never modified; higher versions move all Variants to Draft so stale content cannot resurface.

**Version rules:** new `contentKey` → create-as-Draft; same key+version+same fingerprint → `no_change` (no writes); same version+different bytes → `conflict` (bump `contentVersion`); higher version → `update` into Draft; lower version → `stale`. Failed attempts never block a corrected re-import. Audit records live in `content_imports` (Staff-only, sanitized, bounded).

---

## 19. References

* `schemas/episode-package.schema.json` — authoritative manifest schema (v1.0.0)
* `content-packages/example-episode/` — working two-variant importable example
* `content-packages/typical-workday-sample/` — single-variant public-sample demo
* `content-packages/README.md` + `docs/CONTENT_PIPELINE.md` — full CLI, validation order, editorial codes, checksums, transport, and transaction guarantees
* `docs/PODCAST_DOMAIN.md` — Category → Episode → Variant mapping, level semantics (recommended vs preferred vs browsing vs entitlement), publication invariants, and archival policy
* `shared/content-package/constants.ts` — limits, MIME types, and thresholds the pipeline enforces
* `shared/podcast/domain.ts` — CEFR ordering, level normalization, vocabulary normalization

---

## 20. Prompt preamble for the external AI (copy with the INPUT)

> You are a senior podcast editor and English-language content producer for **Fast English Podcast**, an adult Persian-first English-learning product. You will create a complete Episode editorial package using the template above. Obey the 13-step workflow, the six-Variant consistency rules, the CEFR guidance, and the machine schema exactly as documented. Research authoritative sources before writing any factual claim and never invent citations, statistics, or quotations. Keep editorial notes in the human-readable sections and keep the final `episode.json` strictly inside the schema (section 2). If any required INPUT line is missing or contradictory, stop and ask for clarification rather than guessing.

---

*Template version: 1.0.0 (aligned with `schemaVersion 1.0.0`). No production behavior, schema, import execution, publication, planStateHash/idempotency, Student UI, Admin Studio, audio/player, entitlement, progress, or deployment behavior was changed to create this file.*

