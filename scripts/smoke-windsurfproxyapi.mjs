#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const CONFIG_PATH = resolve(ROOT, 'config', 'config.yaml');
const BASE_URL = (process.env.WPA_BASE_URL || 'http://127.0.0.1:8327').replace(/\/+$/, '');
const INCLUDE_STREAM = process.argv.includes('--stream') || process.env.WPA_SMOKE_STREAM === '1';
const TIMEOUT_MS = Number(process.env.WPA_SMOKE_TIMEOUT_MS || 120_000);

function readLocalApiKey() {
  if (process.env.WPA_API_KEY) return process.env.WPA_API_KEY;
  const text = readFileSync(CONFIG_PATH, 'utf8');
  const match = text.match(/api-keys:\s*(?:\r?\n\s*-\s*([^\s#]+))/);
  if (!match) throw new Error(`No api-keys entry found in ${CONFIG_PATH}`);
  return match[1].trim();
}

const API_KEY = readLocalApiKey();

function authHeaders(extra = {}) {
  return {
    authorization: `Bearer ${API_KEY}`,
    'x-api-key': API_KEY,
    'content-type': 'application/json',
    ...extra,
  };
}

function withTimeout() {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  return { signal: ac.signal, done: () => clearTimeout(timer) };
}

async function requestJson(path, options = {}) {
  const { signal, done } = withTimeout();
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers: options.headers || authHeaders(),
      body: options.body == null ? undefined : JSON.stringify(options.body),
      signal,
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch {}
    return { ok: res.ok, status: res.status, json, text };
  } finally {
    done();
  }
}

async function requestStream(path, body, headers = authHeaders()) {
  const { signal, done } = withTimeout();
  let reader = null;
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...body, stream: true }),
      signal,
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '');
      return { ok: false, status: res.status, bytes: 0, marker: false, text };
    }
    reader = res.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0;
    let text = '';
    while (bytes < 256_000) {
      const { value, done: streamDone } = await reader.read();
      if (streamDone) break;
      bytes += value.byteLength;
      text += decoder.decode(value, { stream: true });
      if (text.includes('data: [DONE]') || text.includes('event: message_stop')) {
        return { ok: true, status: res.status, bytes, marker: true };
      }
    }
    return { ok: bytes > 0, status: res.status, bytes, marker: false };
  } finally {
    try { await reader?.cancel(); } catch {}
    done();
  }
}

function pickModel(models) {
  const ids = new Set(models.map(m => m.id));
  const explicitModel = process.env.WPA_SMOKE_MODEL?.trim();
  if (explicitModel) {
    if (ids.has(explicitModel)) return explicitModel;
    throw new Error(`WPA_SMOKE_MODEL not found in /v1/models: ${explicitModel}`);
  }
  const preferred = [
    'gpt-4o-mini',
    'gemini-2.5-flash',
    'swe-1.5-fast',
    'claude-3.5-sonnet',
  ].filter(Boolean);
  return preferred.find(m => ids.has(m)) || models[0]?.id || 'gpt-4o-mini';
}

function summarize(result) {
  if (result.json?.error) {
    const err = result.json.error;
    return `${err.type || 'error'}: ${err.message || JSON.stringify(err).slice(0, 120)}`;
  }
  if (Array.isArray(result.json?.data)) return `${result.json.data.length} models`;
  if (result.json?.status) return `status=${result.json.status}`;
  if (result.json?.id) return `id=${result.json.id}`;
  return result.text ? result.text.slice(0, 120) : 'ok';
}

const results = [];
async function run(name, fn) {
  try {
    const result = await fn();
    const ok = result.ok === true;
    results.push({ name, ok, result });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name} HTTP ${result.status ?? '-'} ${summarize(result)}`);
    return ok;
  } catch (err) {
    results.push({ name, ok: false, error: err });
    console.log(`FAIL ${name} ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

let selectedModel = 'gpt-4o-mini';

await run('GET /health', async () => {
  const result = await requestJson('/health', { headers: {} });
  return { ...result, ok: result.ok && !!result.json?.gateway && !!result.json?.pool };
});

const modelsOk = await run('GET /v1/models', async () => {
  const result = await requestJson('/v1/models');
  const models = Array.isArray(result.json?.data) ? result.json.data : [];
  selectedModel = pickModel(models);
  console.log(`INFO selected model: ${selectedModel}`);
  return { ...result, ok: result.ok && models.length > 0 };
});

if (!modelsOk) {
  const failed = results.filter(r => !r.ok);
  console.log(`SUMMARY ${results.length - failed.length}/${results.length} passed`);
  process.exit(1);
}

const userPrompt = '只回复 ok';

await run('POST /v1/chat/completions', () => requestJson('/v1/chat/completions', {
  method: 'POST',
  body: {
    model: selectedModel,
    messages: [{ role: 'user', content: userPrompt }],
    max_tokens: 16,
  },
}));

await run('POST /v1/responses', () => requestJson('/v1/responses', {
  method: 'POST',
  body: {
    model: selectedModel,
    input: userPrompt,
    max_output_tokens: 16,
  },
}));

await run('POST /v1/messages', () => requestJson('/v1/messages', {
  method: 'POST',
  headers: authHeaders({ 'anthropic-version': '2023-06-01' }),
  body: {
    model: selectedModel,
    max_tokens: 16,
    messages: [{ role: 'user', content: userPrompt }],
  },
}));

if (INCLUDE_STREAM) {
  await run('STREAM /v1/chat/completions', () => requestStream('/v1/chat/completions', {
    model: selectedModel,
    messages: [{ role: 'user', content: userPrompt }],
    max_tokens: 16,
  }));

  await run('STREAM /v1/messages', () => requestStream('/v1/messages', {
    model: selectedModel,
    max_tokens: 16,
    messages: [{ role: 'user', content: userPrompt }],
  }, authHeaders({ 'anthropic-version': '2023-06-01' })));
}

const failed = results.filter(r => !r.ok);
console.log(`SUMMARY ${results.length - failed.length}/${results.length} passed`);
process.exitCode = failed.length ? 1 : 0;
