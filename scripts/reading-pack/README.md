# Reading pack tools

These scripts build the packs consumed by `php artisan library:import`.
They run outside Laravel; nothing here is used at request time.

## `align_story.py` — original narration

Use for Oxford Bookworms / Inside Reading, where the publisher audio is the
narration and the reviewed text is already known.

- Input: one chapter/track JSON with pages and their reviewed `text_en`.
- It transcribes the track with faster-whisper word timestamps, aligns the
  reviewed words to the heard words, and stores real sentence start/end.
- A sentence with no matched word gets `null` timing; the reader then keeps
  the highlight off instead of guessing.
- Multi-word glosses (`falls down`) are stored as a phrase span.

Requirements: `faster-whisper`, `ffmpeg`, a local `base.en` model, and no
SOCKS proxy in the environment (`ALL_PROXY` breaks httpx on this machine).

```sh
python scripts/reading-pack/align_story.py \
  --pages chapter.json --audio chapter.mp3 \
  --slug story/a2/police-tv --title-en "Police TV" --title-fa "پلیس تلویزیون" \
  --level A2 --cover /images/books/story/police-tv.webp \
  --out /tmp/police-tv-pack
```

For Inside Reading pass `--track inside_reading`; the slug stays the
URL-friendly `inside-reading/...`.

## `woof_passage.py` — IELTS / no supplied audio

Use when the book has no narration. Each sentence is synthesised separately
with the owner's locally installed Underdog Woof model, so sentence timing
is measured from the actual clips; no ASR is needed. The output MP3 carries
`Voice by Underdog Woof`, and the pack sets the same credit.

Requirements: the owner's Woof checkout (`--woof-dir`), `ffmpeg`, and the
commercial-use licence the owner confirmed.

```sh
python scripts/reading-pack/woof_passage.py \
  --input passage.json --out /tmp/ielts-pack \
  --woof-dir /path/to/underdog-woof --voice juno
```

The input carries `sentences_fa` for selection translation and
`evidence_text` per question; the script computes the UTF-16 span by
searching the paragraph. A question whose evidence text is not found is
published with `evidence: null` rather than a wrong span.

Both scripts write the same `pack.json` accepted by
`App\Support\Library\ReadingPackValidator`; see `docs/READERS.md` §4.

## `import_storybook_output.py` — Kidotalks output

Converts the v2 `storybook-output` packs (verified frame text, per-frame
publisher audio, word timings, vocabulary sets, image-job panel map) into
the app pack. Use `--ready-only` to import only books whose catalog entry
is `text=verified`, `audio=ready`, `highlight=ready`.

```sh
python scripts/reading-pack/import_storybook_output.py \
  --source /path/to/storybook-output \
  --out storage/app/private/library-imports/storybook --ready-only
```

The converter never invents timings: a sentence whose highlight groups do
not produce a positive window gets `null` timing, and the reader leaves the
highlight off. The six panel anchors are stored in `meta.panel_map`; if no
sheet exists yet, the app shows a chapter cover opener instead of a fake
scene.

When the owner delivers a sheet later, attach it without bumping the
revision (progress stays intact):

```sh
php artisan library:sheet story/a2/police-tv /path/to/a2-police-tv-sheet.webp
```
