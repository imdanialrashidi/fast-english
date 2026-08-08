// shared/content-package/versioning.ts
// Podcast Slice 3 — import identity and version rules (pure).
//
// Rules (documented in docs/CONTENT_PIPELINE.md):
//   new          — contentKey unknown → create everything as Draft.
//   no_change    — same key + same version + same fingerprint → no write.
//   conflict     — same key + same version + different fingerprint → reject
//                  (increment contentVersion or use controlled replace).
//   update       — same key + higher version → update content into Draft;
//                  an existing Published Episode moves to Draft so the
//                  live experience is never silently overwritten.
//   stale        — lower version → rejected (no rollback workflow yet).
//   rejected     — category missing or other blocking condition.

import type { CefrLevel } from '../podcast/domain.ts';
import type {
  ImportDecision,
  ImportPlan,
  ServerContentState,
  ValidatedContentPackage,
} from './types.ts';

/**
 * The version decision for a package against authoritative server state.
 * `categoryMissing` makes the import impossible (no silent Category
 * creation in this slice).
 */
export function decideImport(
  pkg: Pick<ValidatedContentPackage, 'manifest' | 'fingerprint'>,
  state: ServerContentState,
): ImportDecision {
  if (!state.categoryExists) return 'rejected';
  const manifest = pkg.manifest;
  if (!state.episode) return 'new';
  if (manifest.contentVersion < state.episode.contentVersion) return 'stale';
  if (manifest.contentVersion > state.episode.contentVersion) return 'update';
  // Same version: compare fingerprints.
  if (state.episode.previousFingerprint && state.episode.previousFingerprint === pkg.fingerprint) {
    return 'no_change';
  }
  return 'conflict';
}

/**
 * Builds the deterministic diff plan for a package against server state.
 * The plan is pure: it never reads or writes anything itself.
 */
export function buildPlan(pkg: ValidatedContentPackage, state: ServerContentState): ImportPlan {
  const decision = decideImport(pkg, state);
  const manifest = pkg.manifest;
  const levelOrder: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

  const variants: ImportPlan['variants'] = [];
  const vocabulary: ImportPlan['vocabulary'] = [];
  const mediaUploads: string[] = [];
  let episodesCreate = 0;
  let episodesUpdate = 0;
  let variantsCreate = 0;
  let variantsUpdate = 0;
  let vocabularyCreate = 0;

  let episodeAction: ImportPlan['episode']['action'] = 'none';
  let episodeReason: string | undefined;
  if (decision === 'new') {
    episodeAction = 'create';
    episodesCreate = 1;
  } else if (decision === 'update') {
    episodeAction = 'update';
    episodesUpdate = 1;
  } else if (decision === 'conflict') {
    episodeAction = 'none';
    episodeReason = 'conflict: same content version with a different fingerprint';
  } else if (decision === 'stale') {
    episodeAction = 'none';
    episodeReason = 'stale: imported version is lower than the existing one';
  } else if (decision === 'rejected') {
    episodeAction = 'none';
    episodeReason = 'rejected: category does not exist';
  } else {
    episodeAction = 'none';
    episodeReason = 'no_change: identical package already imported';
  }

  if (decision === 'new' || decision === 'update') {
    mediaUploads.push(manifest.episode.artworkSquare);
    if (manifest.episode.heroImageWide) mediaUploads.push(manifest.episode.heroImageWide);

    const variantsByLevel = new Map(manifest.variants.map((v) => [v.level, v]));
    for (const level of levelOrder) {
      const variant = variantsByLevel.get(level);
      if (!variant) continue;
      const existing = state.variants[level];
      if (existing) {
        variants.push({ level, action: 'update' });
        variantsUpdate += 1;
      } else {
        variants.push({ level, action: 'create' });
        variantsCreate += 1;
      }
      vocabulary.push({ level, count: variant.vocabulary.length });
      vocabularyCreate += variant.vocabulary.length;
      mediaUploads.push(variant.audio);
      for (const entry of variant.vocabulary) {
        if (entry.pronunciationAudio) mediaUploads.push(entry.pronunciationAudio);
      }
    }
  } else {
    for (const level of levelOrder) {
      const variant = manifest.variants.find((v) => v.level === level);
      if (!variant) continue;
      variants.push({ level, action: 'none', reason: episodeReason });
      vocabulary.push({ level, count: variant.vocabulary.length });
    }
  }

  const summary: ImportPlan['summary'] = {
    episodesCreate,
    episodesUpdate,
    variantsCreate,
    variantsUpdate,
    vocabularyCreate,
    mediaUpload: mediaUploads.length,
  };

  return {
    decision,
    contentKey: manifest.contentKey,
    contentVersion: manifest.contentVersion,
    fingerprint: pkg.fingerprint,
    category: {
      key: manifest.categoryKey,
      action: state.categoryExists ? 'reuse' : 'missing',
    },
    episode: { action: episodeAction, reason: episodeReason },
    variants,
    vocabulary,
    media: { uploads: mediaUploads },
    publication: { targetState: 'draft' },
    summary,
  };
}

/**
 * Deterministic human-readable plan (the `content:plan` text output).
 * Mirrors the example in the Podcast Slice 3 brief.
 */
export function formatPlanText(plan: ImportPlan, fingerprint: string): string {
  const lines: string[] = [];
  lines.push('Package');
  lines.push(`  contentKey: ${plan.contentKey}`);
  lines.push(`  contentVersion: ${plan.contentVersion}`);
  lines.push(`  fingerprint: ${fingerprint}`);
  lines.push('');
  lines.push('Category');
  lines.push(`  ${plan.category.action === 'reuse' ? 'reuse' : 'missing'}: ${plan.category.key}`);
  lines.push('');
  lines.push('Episode');
  if (plan.episode.action === 'create') {
    lines.push(`  create: ${plan.contentKey.split('.').slice(1).join('.')}`);
    lines.push('  artwork: upload');
    if (plan.media.uploads.length > 1) lines.push('  hero: upload');
  } else if (plan.episode.action === 'update') {
    lines.push(`  update: ${plan.contentKey.split('.').slice(1).join('.')}`);
    lines.push('  artwork: upload');
    if (plan.media.uploads.length > 1) lines.push('  hero: upload');
    lines.push('  state: draft (existing published content is not overwritten)');
  } else {
    lines.push(`  ${plan.episode.action}: ${plan.episode.reason ?? 'no action'}`);
  }
  lines.push('Variants');
  if (plan.variants.length === 0) {
    lines.push('  (none)');
  }
  for (const v of plan.variants) {
    lines.push(`  ${v.level}: ${v.action}${v.reason ? ` (${v.reason})` : ''}`);
  }
  lines.push('');
  lines.push('Vocabulary');
  for (const v of plan.vocabulary) {
    lines.push(`  ${v.level}: ${v.count} create`);
  }
  lines.push('');
  lines.push('Publication');
  lines.push(`  target state: ${plan.publication.targetState}`);
  lines.push('');
  lines.push('Result');
  lines.push(`  ${plan.summary.episodesCreate} Episode create`);
  lines.push(`  ${plan.summary.variantsCreate} Variants create`);
  lines.push(`  ${plan.summary.vocabularyCreate} Vocabulary create`);
  lines.push(`  ${plan.summary.mediaUpload} Media upload`);
  return lines.join('\n');
}
