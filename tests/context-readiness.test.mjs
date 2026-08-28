import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeDocument,
  analyzeProjectContext,
  contextDocuments,
} from '../scripts/validate-project-context.mjs';

test('an untouched template-shaped context is explicitly not ready for product work', () => {
  const documents = Object.fromEntries(
    contextDocuments.map(({ path }) => [
      path,
      '# Template contract\\n\\n- Primary users:\\n\\nKeep this document short after /wf-bootstrap.\\n',
    ]),
  );
  const report = analyzeProjectContext(documents);
  assert.equal(report.ready, false);
  assert.equal(report.documents.length, contextDocuments.length);
  assert(report.documents.every((document) => document.signals.length > 0));
  assert(report.blockedDocuments.includes('docs/PRODUCT.md'));
});

test('filled contracts, including explicit unknowns, satisfy the readiness gate', () => {
  const documents = Object.fromEntries(
    contextDocuments.map(({ path }) => [
      path,
      `# Confirmed contract\n\nOwner: team\nStatus: UNKNOWN until measured\nDecision: confirmed for this slice\n`,
    ]),
  );
  const report = analyzeProjectContext(documents);
  assert.equal(report.ready, true);
  assert.deepEqual(report.blockedDocuments, []);
});

test('readiness detects empty fields but does not reject ordinary prose', () => {
  const report = analyzeDocument(
    '# Product\n\nThe product serves a known audience.\n\n- Primary users: \n- Problem being solved: \n',
    'docs/PRODUCT.md',
  );
  assert.equal(report.ready, false);
  assert(report.counts.emptyFields >= 2);
  assert.equal(
    analyzeDocument('# Notes\n\nThis document explains why a field is optional.').ready,
    true,
  );
});

test('missing context files are reported as missing rather than silently ready', () => {
  const report = analyzeProjectContext(
    new Map([['docs/PRODUCT.md', '# Product\nConfirmed scope\n']]),
  );
  assert.equal(report.ready, false);
  assert(report.documents.filter((document) => document.missing).length >= 3);
});
