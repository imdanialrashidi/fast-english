#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const repositoryRoot = path.resolve(import.meta.dirname, '..');

// These are the four durable contracts that /wf-bootstrap is expected to
// specialize. The validator is deliberately conservative: explicit unknowns
// are valid project context, while empty template fields are not.
export const contextDocuments = [
  { path: 'docs/PRODUCT.md', label: 'product' },
  { path: 'docs/DESIGN.md', label: 'design' },
  { path: 'docs/ARCHITECTURE.md', label: 'architecture' },
  { path: 'docs/QUALITY.md', label: 'quality' },
];

const emptyField = /^\s*-\s+[^\n:]+:\s*$/gm;
const emptyOrderedItem = /^\s*\d+\.\s*$/gm;
const emptyChecklist = /^\s*-\s*\[\s*\]\s*$/gm;
const emptyTableRow = /^\|\s*(?:\|\s*)+$/gm;
const templateSentinels = [
  /replace template prompts with accepted decisions/i,
  /keep it project-specific after `?\/wf-bootstrap/i,
  /do not turn this into a generic checklist dump/i,
  /keep this document (?:short|specific)/i,
];

function matches(text, pattern) {
  return [...text.matchAll(pattern)].map((match) => match[0].trim()).filter(Boolean);
}

export function analyzeDocument(text, documentPath = 'document') {
  assert.equal(typeof text, 'string', `${documentPath} must be text`);
  const signals = [];
  const emptyFields = matches(text, emptyField);
  const emptyOrderedItems = matches(text, emptyOrderedItem);
  const emptyChecklists = matches(text, emptyChecklist);
  // Separator rows contain dashes, so they are not classified as empty rows.
  const emptyTableRows = matches(text, emptyTableRow).filter(
    (row) => !row.replace(/[|\s]/g, '').match(/^-+$/),
  );
  const sentinelMatches = templateSentinels
    .filter((pattern) => pattern.test(text))
    .map((pattern) => pattern.source);

  if (emptyFields.length) signals.push('empty labeled fields');
  if (emptyOrderedItems.length) signals.push('empty ordered items');
  if (emptyChecklists.length) signals.push('empty acceptance checkboxes');
  if (emptyTableRows.length) signals.push('empty decision-table rows');
  if (sentinelMatches.length) signals.push('template guidance remains');
  if (text.trim().length === 0) signals.push('empty document');

  return {
    path: documentPath,
    bytes: Buffer.byteLength(text),
    ready: signals.length === 0,
    signals,
    counts: {
      emptyFields: emptyFields.length,
      emptyOrderedItems: emptyOrderedItems.length,
      emptyChecklists: emptyChecklists.length,
      emptyTableRows: emptyTableRows.length,
      templateGuidance: sentinelMatches.length,
    },
  };
}

function readDocument(source, documentPath) {
  if (source instanceof Map) {
    if (source.has(documentPath)) return source.get(documentPath);
    const error = new Error(`Missing context document: ${documentPath}`);
    error.code = 'ENOENT';
    throw error;
  }
  if (source && typeof source === 'object') {
    if (Object.hasOwn(source, documentPath)) return source[documentPath];
    const error = new Error(`Missing context document: ${documentPath}`);
    error.code = 'ENOENT';
    throw error;
  }
  return fs.readFileSync(path.join(repositoryRoot, documentPath), 'utf8');
}

export function analyzeProjectContext(source = undefined) {
  const reports = contextDocuments.map(({ path: documentPath, label }) => {
    try {
      const text = readDocument(source, documentPath);
      return { ...analyzeDocument(text, documentPath), label, missing: false };
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      return {
        path: documentPath,
        label,
        bytes: 0,
        ready: false,
        missing: true,
        signals: ['missing document'],
        counts: {},
      };
    }
  });
  return {
    ready: reports.every((report) => report.ready),
    documents: reports,
    readyDocuments: reports.filter((report) => report.ready).map((report) => report.path),
    blockedDocuments: reports.filter((report) => !report.ready).map((report) => report.path),
  };
}

export function formatReport(report) {
  const status = report.ready ? 'READY' : 'NOT READY';
  const lines = [
    `${status} project context: ${report.readyDocuments.length}/${report.documents.length} durable contracts filled`,
  ];
  for (const document of report.documents) {
    lines.push(
      `- ${document.path}: ${document.ready ? 'READY' : document.missing ? 'MISSING' : 'TEMPLATE'}${document.signals?.length ? ` (${document.signals.join(', ')})` : ''}`,
    );
  }
  return lines.join('\n');
}

function parseArgs(argv) {
  const options = { requireReady: false, static: false };
  for (const token of argv) {
    if (token === '--require-ready' || token === '--strict') options.requireReady = true;
    else if (token === '--static') options.static = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return options;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const report = analyzeProjectContext();
    console.log(formatReport(report));
    if (options.requireReady && !report.ready) process.exitCode = 1;
    // --static is intentionally informational for an unbootstrapped template;
    // use --require-ready after /wf-bootstrap to turn it into a gate.
  } catch (error) {
    console.error(`FAIL project-context validation: ${error.message}`);
    process.exitCode = 1;
  }
}
