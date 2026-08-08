// shared/content-package/schema.ts
// Podcast Slice 3 — JSON Schema validation of the Episode manifest.
//
// Uses Ajv (draft 2020-12) against schemas/episode-package.schema.json.
// Ajv runs in Node (CLI pipeline) and browsers (future Admin Console).
// The schema enforces structure and types; semantic/editorial checks
// live in editorial.ts; filesystem and media checks live in the CLI
// pipeline and are re-validated authoritatively by the server hooks.

import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020.js';
import schema from '../../schemas/episode-package.schema.json' with { type: 'json' };
import type { ContentDiagnostic, EpisodeManifest } from './types.ts';

// `$schema` is allowed on the instance but is not contract data.
const INSTANCE_KEYS = new Set([
  '$schema',
  'schemaVersion',
  'contentKey',
  'contentVersion',
  'categoryKey',
  'episode',
  'variants',
]);

let validator: ValidateFunction<EpisodeManifest> | null = null;

function getValidator(): ValidateFunction<EpisodeManifest> {
  if (validator) return validator;
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  validator = ajv.compile<EpisodeManifest>(schema);
  return validator;
}

/**
 * Validates a parsed manifest against the JSON Schema and returns
 * diagnostics with stable codes (SCHEMA_*) in the Ajv error order.
 */
export function validateManifestSchema(manifest: unknown): {
  valid: boolean;
  diagnostics: ContentDiagnostic[];
} {
  const unknownKeys: ContentDiagnostic[] = [];
  if (manifest && typeof manifest === 'object' && !Array.isArray(manifest)) {
    for (const key of Object.keys(manifest)) {
      if (!INSTANCE_KEYS.has(key)) {
        unknownKeys.push({
          code: 'SCHEMA_UNKNOWN_PROPERTY',
          severity: 'error',
          path: key,
          message: `Unknown property "${key}" is not allowed.`,
        });
      }
    }
  }
  const validate = getValidator();
  const valid = validate(manifest);
  const diagnostics = unknownKeys.slice(0, 20);
  if (!valid && validate.errors) {
    for (const err of validate.errors.slice(0, 50)) {
      diagnostics.push({
        code: `SCHEMA_${(err.keyword || 'invalid').toUpperCase()}`,
        severity: 'error',
        path: err.instancePath || '$',
        message: err.message ?? 'Schema validation failed.',
      });
    }
  }
  return { valid: diagnostics.length === 0 && valid, diagnostics };
}
