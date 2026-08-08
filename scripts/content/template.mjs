// scripts/content/template.mjs
// Podcast Slice 3 — `content:new` template generator.
//
// Creates a human-editable package skeleton with one minimal example
// Variant (B1 by default) whose required values are TODO_REPLACE
// placeholders. The generated package deliberately fails strict import
// until the placeholders are replaced (validation blocks them). The
// command never touches the database and refuses to overwrite an
// existing directory.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TEMPLATE_DEFAULT_LEVEL } from '../../shared/content-package/constants.ts';
import { isValidSlug } from '../../shared/content-package/normalize.ts';

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/**
 * Generates a package directory for `slug` under `contentDir`.
 * Returns the list of created paths. Throws on an invalid slug or an
 * existing directory.
 */
export function generateTemplate(contentDir, slug, { levels = [TEMPLATE_DEFAULT_LEVEL] } = {}) {
  if (!isValidSlug(slug)) {
    throw new Error(
      `Invalid episode slug "${slug}". Use lowercase letters and digits separated by single hyphens (e.g. pyramids-of-egypt).`,
    );
  }
  const requested = [...new Set(levels.map((l) => l.trim().toUpperCase()))];
  const bad = requested.filter((l) => !LEVELS.includes(l));
  if (bad.length > 0) {
    throw new Error(`Invalid CEFR level(s): ${bad.join(', ')}. Use: ${LEVELS.join(', ')}.`);
  }
  const dir = join(contentDir, slug);
  mkdirSync(contentDir, { recursive: true });
  try {
    mkdirSync(dir, { recursive: false });
  } catch (err) {
    if (err?.code === 'EEXIST') {
      throw new Error(`Directory already exists: ${dir} — refusing to overwrite.`);
    }
    throw err;
  }
  mkdirSync(join(dir, 'artwork'));
  mkdirSync(join(dir, 'audio'));
  mkdirSync(join(dir, 'transcripts'));

  const categoryKey = 'general';
  const contentKey = `${categoryKey}.${slug}`;

  const variants = requested.map((level) => ({
    level,
    summaryFa: 'TODO_REPLACE',
    audio: `audio/${level.toLowerCase()}.mp3`,
    transcript: `transcripts/${level.toLowerCase()}.md`,
    vocabulary: [
      {
        term: 'TODO_REPLACE',
        phonetic: '/TODO_REPLACE/',
        partOfSpeech: 'noun',
        meaningFa: 'TODO_REPLACE',
        definitionEn: 'TODO_REPLACE',
        exampleSentence: 'TODO_REPLACE',
      },
    ],
  }));

  const manifest = {
    $schema: '../../schemas/episode-package.schema.json',
    schemaVersion: '1.0.0',
    contentKey,
    contentVersion: 1,
    categoryKey,
    episode: {
      slug,
      titleEn: 'TODO_REPLACE',
      titleFa: 'TODO_REPLACE',
      descriptionFa: 'TODO_REPLACE',
      artworkSquare: 'artwork/square.webp',
      heroImageWide: 'artwork/hero.webp',
      artworkAltFa: 'TODO_REPLACE',
      episodeNumber: 1,
      featured: false,
    },
    variants,
  };

  writeFileSync(join(dir, 'episode.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  const readme = `# ${slug}

Episode content package (Fast English Podcast Content Pipeline).

## Status

TEMPLATE — intentionally invalid until every TODO_REPLACE value is replaced.
Run \`pnpm content:validate ${join(contentDir, slug)}\` to see what is missing.

## Required steps

1. Replace every TODO_REPLACE value in \`episode.json\`.
2. Add artwork:
   - \`artwork/square.webp\` — square Episode artwork (JPEG/PNG/WebP, ≤5 MB).
   - \`artwork/hero.webp\` — optional wide hero (landscape, ~16:9).
3. Add audio (MP3 or M4A, ≤10 MB per Variant):
${requested.map((l) => `   - \`audio/${l.toLowerCase()}.mp3\` — ${l} Variant audio.`).join('\n')}
4. Add transcripts (UTF-8 Markdown):
${requested.map((l) => `   - \`transcripts/${l.toLowerCase()}.md\` — ${l} Variant transcript.`).join('\n')}
5. Validate locally:      \`pnpm content:validate ${join(contentDir, slug)}\`
6. Inspect the dry-run:  \`pnpm content:plan ${join(contentDir, slug)}\`
7. Import as Draft:      \`pnpm content:import ${join(contentDir, slug)}\`

The Category \`${categoryKey}\` must already exist in the database; the
pipeline never creates Categories.
`;

  writeFileSync(join(dir, 'README.md'), readme);

  return {
    dir,
    paths: [
      join(dir, 'episode.json'),
      join(dir, 'README.md'),
      join(dir, 'artwork'),
      join(dir, 'audio'),
      join(dir, 'transcripts'),
    ],
    levels: requested,
  };
}
