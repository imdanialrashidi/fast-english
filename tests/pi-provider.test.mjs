import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { addCustomProvider, resolveAgentDir } from '../scripts/pi-provider.mjs';

const artifactsRoot = path.resolve(import.meta.dirname, '../.artifacts');

async function temporaryAgentDir() {
  await fs.mkdir(artifactsRoot, { recursive: true });
  return fs.mkdtemp(path.join(artifactsRoot, 'pi-provider-test-'));
}

const basicProvider = {
  providerId: 'my-provider',
  api: 'openai-completions',
  baseUrl: 'https://api.example.test/v1',
  modelId: 'my-model',
};

test('provider setup adds a Pi model, keeps existing config, and isolates the key', async () => {
  const agentDir = await temporaryAgentDir();
  try {
    await fs.writeFile(
      path.join(agentDir, 'models.json'),
      JSON.stringify({
        providers: {
          existing: {
            api: 'openai-completions',
            baseUrl: 'https://other.test/v1',
            models: [{ id: 'keep-me' }],
          },
        },
        unrelatedSetting: true,
      }),
    );
    await fs.writeFile(
      path.join(agentDir, 'auth.json'),
      JSON.stringify({ existing: { type: 'api_key', key: 'old-key' } }),
    );

    const result = await addCustomProvider({
      ...basicProvider,
      agentDir,
      apiKey: 'secret-test-key',
    });
    const models = JSON.parse(await fs.readFile(path.join(agentDir, 'models.json'), 'utf8'));
    const auth = JSON.parse(await fs.readFile(path.join(agentDir, 'auth.json'), 'utf8'));
    const stat = await fs.stat(path.join(agentDir, 'auth.json'));

    assert.equal(result.model, 'my-provider/my-model');
    assert.equal(models.unrelatedSetting, true);
    assert.deepEqual(models.providers.existing.models, [{ id: 'keep-me' }]);
    assert.equal(models.providers['my-provider'].baseUrl, 'https://api.example.test/v1');
    assert.deepEqual(models.providers['my-provider'].models[0], {
      id: 'my-model',
      name: 'my-model',
      input: ['text'],
      reasoning: false,
      contextWindow: 128000,
      maxTokens: 16384,
    });
    assert.equal(JSON.stringify(models).includes('secret-test-key'), false);
    assert.deepEqual(auth.existing, { type: 'api_key', key: 'old-key' });
    assert.deepEqual(auth['my-provider'], { type: 'api_key', key: 'secret-test-key' });
    assert.equal(stat.mode & 0o777, 0o600);
    assert.equal((await fs.stat(path.join(agentDir, 'models.json'))).mode & 0o777, 0o600);
  } finally {
    await fs.rm(agentDir, { recursive: true, force: true });
  }
});

test("provider setup safely appends models and uses Pi's keyless placeholder", async () => {
  const agentDir = await temporaryAgentDir();
  try {
    await addCustomProvider({ ...basicProvider, agentDir, apiKey: 'first-key' });
    const result = await addCustomProvider({
      ...basicProvider,
      agentDir,
      modelId: 'second-model',
      capabilities: { input: ['text', 'image'], reasoning: true },
      contextWindow: 64000,
      maxTokens: 8000,
      apiKey: '',
    });
    const models = JSON.parse(await fs.readFile(path.join(agentDir, 'models.json'), 'utf8'));
    const auth = JSON.parse(await fs.readFile(path.join(agentDir, 'auth.json'), 'utf8'));

    assert.equal(result.authPath, null);
    assert.equal(models.providers['my-provider'].apiKey, undefined);
    assert.equal(models.providers['my-provider'].models.length, 2);
    assert.deepEqual(models.providers['my-provider'].models[1], {
      id: 'second-model',
      name: 'second-model',
      input: ['text', 'image'],
      reasoning: true,
      contextWindow: 64000,
      maxTokens: 8000,
    });
    assert.deepEqual(auth['my-provider'], { type: 'api_key', key: 'first-key' });
  } finally {
    await fs.rm(agentDir, { recursive: true, force: true });
  }
});

test('provider setup refuses duplicate models, incompatible IDs, corrupt files, and symlinks without overwriting', async () => {
  const agentDir = await temporaryAgentDir();
  try {
    await addCustomProvider({ ...basicProvider, agentDir, apiKey: 'first-key' });
    const modelsPath = path.join(agentDir, 'models.json');
    const original = await fs.readFile(modelsPath, 'utf8');

    await assert.rejects(
      addCustomProvider({ ...basicProvider, agentDir, apiKey: 'other-key' }),
      /already exists; nothing was changed/,
    );
    await assert.rejects(
      addCustomProvider({ ...basicProvider, agentDir, baseUrl: 'https://changed.test/v1' }),
      /different API or URL/,
    );
    assert.equal(await fs.readFile(modelsPath, 'utf8'), original);

    await fs.writeFile(modelsPath, 'not json');
    await assert.rejects(
      addCustomProvider({ ...basicProvider, agentDir }),
      /valid JSON; it was left untouched/,
    );
    assert.equal(await fs.readFile(modelsPath, 'utf8'), 'not json');

    await fs.unlink(modelsPath);
    const actual = path.join(agentDir, 'actual.json');
    await fs.writeFile(actual, '{}');
    await fs.symlink(actual, modelsPath);
    await assert.rejects(
      addCustomProvider({ ...basicProvider, agentDir }),
      /regular file, not a symlink/,
    );
    assert.equal(await fs.readFile(actual, 'utf8'), '{}');
  } finally {
    await fs.rm(agentDir, { recursive: true, force: true });
  }
});

test('Pi agent directory follows PI_CODING_AGENT_DIR and its tilde expansion', () => {
  assert.equal(
    resolveAgentDir({
      env: { PI_CODING_AGENT_DIR: '~/custom-agent' },
      home: '/home/test',
      cwd: '/tmp',
    }),
    '/home/test/custom-agent',
  );
  assert.equal(
    resolveAgentDir({ env: {}, home: '/home/test', cwd: '/tmp' }),
    '/home/test/.pi/agent',
  );
});
