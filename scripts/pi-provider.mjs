#!/usr/bin/env node

import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { StringDecoder } from 'node:string_decoder';
import { pathToFileURL } from 'node:url';

export const API_TYPES = [
  { value: 'openai-completions', label: 'OpenAI-compatible Chat Completions (default)' },
  { value: 'openai-responses', label: 'OpenAI Responses' },
  { value: 'anthropic-messages', label: 'Anthropic Messages' },
  { value: 'google-generative-ai', label: 'Google Generative AI' },
];

export const MODEL_CAPABILITIES = [
  { input: ['text'], reasoning: false, label: 'Text only (default)' },
  { input: ['text', 'image'], reasoning: false, label: 'Text and images' },
  { input: ['text'], reasoning: true, label: 'Text and reasoning' },
  { input: ['text', 'image'], reasoning: true, label: 'Text, images, and reasoning' },
];

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export function resolveAgentDir({ env = process.env, home = homedir(), cwd = process.cwd() } = {}) {
  let value = env.PI_CODING_AGENT_DIR || path.join(home, '.pi', 'agent');
  if (value === '~') value = home;
  else if (value.startsWith('~/')) value = path.join(home, value.slice(2));
  return path.resolve(cwd, value);
}

export function validateProviderInput({
  providerId,
  api,
  baseUrl,
  modelId,
  contextWindow,
  maxTokens,
}) {
  if (!/^[a-z][a-z0-9-]{0,62}$/.test(providerId)) {
    throw new Error(
      'Provider ID must be lowercase, start with a letter, and contain only letters, numbers, and hyphens.',
    );
  }
  if (!API_TYPES.some((type) => type.value === api))
    throw new Error('Choose one of the supported Pi API types.');
  if (
    typeof modelId !== 'string' ||
    !modelId.trim() ||
    modelId.length > 256 ||
    /[\p{Cc}]/u.test(modelId)
  ) {
    throw new Error(
      'Model ID must be non-empty, at most 256 characters, and contain no control characters.',
    );
  }

  let endpoint;
  try {
    endpoint = new URL(baseUrl);
  } catch {
    throw new Error(
      'Enter a complete API base URL, including https:// (or http:// for a local endpoint).',
    );
  }
  if (
    !['https:', 'http:'].includes(endpoint.protocol) ||
    !endpoint.hostname ||
    endpoint.username ||
    endpoint.password ||
    endpoint.hash
  ) {
    throw new Error(
      'API base URL must use HTTP(S), contain a hostname, and have no credentials or fragment.',
    );
  }
  if (/(?:api[_-]?key|access[_-]?token|auth|secret|token)=/i.test(endpoint.search)) {
    throw new Error('Do not put credentials in the URL; use the hidden API-key prompt.');
  }
  if (
    !Number.isSafeInteger(contextWindow) ||
    contextWindow < 1 ||
    !Number.isSafeInteger(maxTokens) ||
    maxTokens < 1 ||
    maxTokens > contextWindow
  ) {
    throw new Error(
      'Context window and output limit must be positive integers, and output cannot exceed context.',
    );
  }
}

async function readJsonObject(filePath, label) {
  let info;
  try {
    info = await fs.lstat(filePath);
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
  if (info.isSymbolicLink() || !info.isFile())
    throw new Error(`${label} must be a regular file, not a symlink or directory: ${filePath}`);
  let parsed;
  try {
    parsed = JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    throw new Error(
      `Cannot read ${label} as valid JSON; it was left untouched (${error.message}).`,
    );
  }
  if (!isRecord(parsed))
    throw new Error(`${label} must contain a JSON object; it was left untouched.`);
  return parsed;
}

async function atomicWriteJson(filePath, value) {
  const tempPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`,
  );
  let handle;
  try {
    handle = await fs.open(tempPath, 'wx', 0o600);
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await handle.sync();
    await handle.close();
    handle = undefined;
    await fs.chmod(tempPath, 0o600);
    await fs.rename(tempPath, filePath);
  } finally {
    if (handle) await handle.close().catch(() => {});
    await fs.unlink(tempPath).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}

export async function addCustomProvider({
  agentDir,
  providerId,
  api,
  baseUrl,
  modelId,
  modelName = modelId,
  capabilities = MODEL_CAPABILITIES[0],
  contextWindow = 128000,
  maxTokens = 16384,
  apiKey = '',
}) {
  validateProviderInput({ providerId, api, baseUrl, modelId, contextWindow, maxTokens });
  const cleanBaseUrl = new URL(baseUrl).href.replace(/\/$/, '');
  const modelsPath = path.join(agentDir, 'models.json');
  const authPath = path.join(agentDir, 'auth.json');
  const modelsConfig = await readJsonObject(modelsPath, 'Pi models.json');
  const authConfig = await readJsonObject(authPath, 'Pi auth.json');

  if (modelsConfig.providers === undefined) modelsConfig.providers = {};
  if (!isRecord(modelsConfig.providers))
    throw new Error("Pi models.json 'providers' must be an object; it was left untouched.");

  let provider = modelsConfig.providers[providerId];
  if (provider === undefined) {
    provider = { api, baseUrl: cleanBaseUrl, models: [] };
    modelsConfig.providers[providerId] = provider;
  } else {
    if (!isRecord(provider))
      throw new Error(
        `Provider '${providerId}' has an invalid configuration; it was left untouched.`,
      );
    if (provider.api !== api || provider.baseUrl !== cleanBaseUrl) {
      throw new Error(
        `Provider '${providerId}' already uses a different API or URL. Choose a new provider ID to preserve its configuration.`,
      );
    }
    if (!Array.isArray(provider.models))
      throw new Error(`Provider '${providerId}' has no valid models list; it was left untouched.`);
  }

  if (provider.models.some((model) => model?.id === modelId)) {
    throw new Error(`Model '${providerId}/${modelId}' already exists; nothing was changed.`);
  }
  if (
    !Array.isArray(capabilities?.input) ||
    !capabilities.input.includes('text') ||
    typeof capabilities.reasoning !== 'boolean'
  ) {
    throw new Error('Model capabilities must define text input and a reasoning flag.');
  }

  provider.models.push({
    id: modelId,
    name: modelName.trim() || modelId,
    input: capabilities.input,
    reasoning: capabilities.reasoning,
    contextWindow,
    maxTokens,
  });

  let authChanged = false;
  let placeholderAdded = false;
  if (apiKey) {
    authConfig[providerId] = { type: 'api_key', key: apiKey };
    authChanged = true;
  } else if (!authConfig[providerId] && !provider.apiKey) {
    // Pi requires a resolved key for custom providers. Its provider docs use "public"
    // as the placeholder for keyless local endpoints such as Ollama.
    provider.apiKey = 'public';
    placeholderAdded = true;
  }

  await fs.mkdir(agentDir, { recursive: true, mode: 0o700 });
  if (authChanged) await atomicWriteJson(authPath, authConfig);
  await atomicWriteJson(modelsPath, modelsConfig);

  return {
    modelsPath,
    authPath: authChanged ? authPath : null,
    model: `${providerId}/${modelId}`,
    placeholderAdded,
  };
}

async function askLine(message, defaultValue) {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question(message);
    return answer.trim() || defaultValue || '';
  } finally {
    rl.close();
  }
}

function askSecretHidden(message) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    throw new Error(
      'Run ./p --add-provider in an interactive terminal so the API key can be entered without echo.',
    );
  }

  const wasRaw = stdin.isRaw;
  const decoder = new StringDecoder('utf8');
  let value = '';
  let pendingEscape = false;
  let escapeSequence = false;
  stdout.write(message);
  stdin.setRawMode(true);
  stdin.resume();

  return new Promise((resolve, reject) => {
    const finish = (error) => {
      stdin.removeListener('data', onData);
      stdin.setRawMode(wasRaw);
      stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk) => {
      for (const character of decoder.write(chunk)) {
        const code = character.codePointAt(0);
        if (escapeSequence) {
          if (code >= 0x40 && code <= 0x7e) escapeSequence = false;
          continue;
        }
        if (pendingEscape) {
          pendingEscape = false;
          if (character === '[') escapeSequence = true;
          continue;
        }
        if (character === '\u001b') {
          pendingEscape = true;
          continue;
        }
        if (character === '\r' || character === '\n') return finish();
        if (code === 3 || code === 4) return finish(new Error('Provider setup cancelled.'));
        if (code === 8 || code === 127) {
          value = Array.from(value).slice(0, -1).join('');
        } else if (code === 21) {
          value = '';
        } else if (code >= 0x20 && code !== 0x7f) {
          value += character;
        }
      }
    };
    stdin.on('data', onData);
  });
}

async function askNumber(message, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  const raw = await askLine(message, String(fallback));
  const number = Number(raw);
  if (!Number.isSafeInteger(number) || number < 1 || number > maximum)
    throw new Error(`Enter a whole number between 1 and ${maximum}.`);
  return number;
}

export async function runWizard({
  prompt = askLine,
  secret = askSecretHidden,
  env = process.env,
  home = homedir(),
  cwd = process.cwd(),
} = {}) {
  const agentDir = resolveAgentDir({ env, home, cwd });
  stdout.write('Add a custom provider to your personal Pi configuration.\n');
  stdout.write(
    "Use an endpoint that speaks one of Pi's four listed API protocols; other protocols need a Pi extension.\n\n",
  );

  const providerId = await prompt('Provider ID (lowercase, for example: my-provider): ');
  const apiChoice = await prompt(
    `${API_TYPES.map((type, index) => `${index + 1}) ${type.label}`).join('\n')}\nAPI type [1]: `,
    '1',
  );
  const apiIndex = Number(apiChoice) - 1;
  const api = Number.isInteger(apiIndex) ? API_TYPES[apiIndex]?.value : undefined;
  if (!api) throw new Error('Select API type 1, 2, 3, or 4.');

  const baseUrl = await prompt('API base URL (include /v1 when required): ');
  const modelId = await prompt('Exact model ID used by the provider: ');
  const capabilityChoice = await prompt(
    `${MODEL_CAPABILITIES.map((item, index) => `${index + 1}) ${item.label}`).join('\n')}\nModel capabilities [1]: `,
    '1',
  );
  const capabilityIndex = Number(capabilityChoice) - 1;
  const capabilities = Number.isInteger(capabilityIndex)
    ? MODEL_CAPABILITIES[capabilityIndex]
    : undefined;
  if (!capabilities) throw new Error('Select capability option 1, 2, 3, or 4.');

  const contextWindow = await askNumber('Context window tokens [128000]: ', 128000);
  const maxTokens = await askNumber('Maximum output tokens [16384]: ', 16384, contextWindow);
  const apiKey = await secret('API key (hidden; leave blank only for a keyless/local service): ');

  const result = await addCustomProvider({
    agentDir,
    providerId,
    api,
    baseUrl,
    modelId,
    capabilities,
    contextWindow,
    maxTokens,
    apiKey,
  });
  stdout.write(`Added ${result.model}.\n`);
  if (result.authPath)
    stdout.write(
      "API key saved in Pi's private auth.json (0600); it was not written to the project.\n",
    );
  else if (result.placeholderAdded)
    stdout.write("No key saved. Added Pi's 'public' placeholder for a keyless endpoint.\n");
  else stdout.write('No key entered; existing provider credentials were preserved.\n');
  stdout.write(
    `In Pi, open /model and select ${result.model}. Opening /model reloads models.json.\n`,
  );
  return result;
}

async function main() {
  try {
    if (!stdin.isTTY || !stdout.isTTY) {
      throw new Error(
        'Run ./p --add-provider in an interactive terminal so the API key can be entered without echo.',
      );
    }
    await runWizard();
  } finally {
    if (stdin.isTTY) {
      if (stdin.isRaw) stdin.setRawMode(false);
      stdin.pause();
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    const cancelled = error.message === 'Provider setup cancelled.';
    console.error(`${cancelled ? 'Cancelled' : 'Provider setup failed'}: ${error.message}`);
    process.exitCode = cancelled ? 130 : 1;
  });
}
