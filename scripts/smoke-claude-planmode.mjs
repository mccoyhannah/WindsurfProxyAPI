#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const CONFIG_PATH = resolve(ROOT, 'config', 'config.yaml');
const BASE_URL = (process.env.WPA_BASE_URL || 'http://127.0.0.1:8327').replace(/\/+$/, '');
const MODEL = process.env.WPA_PLANMODE_MODEL || process.env.WPA_SMOKE_MODEL || 'claude-sonnet-4.6-thinking';
const TIMEOUT_MS = Number(process.env.WPA_PLANMODE_TIMEOUT_MS || 180_000);

function readLocalApiKey() {
  if (process.env.WPA_API_KEY) return process.env.WPA_API_KEY;
  const text = readFileSync(CONFIG_PATH, 'utf8');
  const match = text.match(/api-keys:\s*(?:\r?\n\s*-\s*([^\s#]+))/);
  if (!match) throw new Error(`No api-keys entry found in ${CONFIG_PATH}`);
  return match[1].trim();
}

const API_KEY = readLocalApiKey();

function authHeaders() {
  return {
    authorization: `Bearer ${API_KEY}`,
    'x-api-key': API_KEY,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
  };
}

function withTimeout() {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  return { signal: ac.signal, done: () => clearTimeout(timer) };
}

function parseSseFrames(raw) {
  const frames = [];
  for (const block of raw.split(/\r?\n\r?\n/)) {
    if (!block.trim()) continue;
    let event = 'message';
    const data = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
    }
    frames.push({ event, data: data.join('\n') });
  }
  return frames;
}

function readPlanFromJson(jsonText) {
  if (!jsonText) return '';
  try {
    const parsed = JSON.parse(jsonText);
    return typeof parsed?.plan === 'string' ? parsed.plan.trim() : '';
  } catch {
    return '';
  }
}

async function requestPlanModeStream() {
  const { signal, done } = withTimeout();
  try {
    const res = await fetch(`${BASE_URL}/v1/messages`, {
      method: 'POST',
      headers: authHeaders(),
      signal,
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 512,
        temperature: 0.1,
        stream: true,
        system: 'You are Claude Code. When asked for a final plan, use ExitPlanMode exactly once.',
        messages: [
          {
            role: 'user',
            content: 'Please produce a concise final plan for a harmless one-file cleanup task. Return it via ExitPlanMode only.',
          },
        ],
        tools: [
          {
            name: 'ExitPlanMode',
            description: 'Submit the final implementation plan to the Claude Code plan UI.',
            input_schema: {
              type: 'object',
              properties: {
                plan: { type: 'string' },
              },
              required: ['plan'],
            },
          },
        ],
        tool_choice: { type: 'tool', name: 'ExitPlanMode' },
      }),
    });
    const raw = await res.text();
    return { status: res.status, ok: res.ok, raw };
  } finally {
    done();
  }
}

const result = await requestPlanModeStream();
if (!result.ok) {
  console.error(`FAIL POST /v1/messages HTTP ${result.status}`);
  console.error(result.raw.slice(0, 2000));
  process.exit(1);
}

const frames = parseSseFrames(result.raw);
let toolName = '';
let toolId = '';
let toolInputJson = '';
let stopReason = '';
let text = '';

for (const frame of frames) {
  if (!frame.data || frame.data === '[DONE]') continue;
  let payload = null;
  try { payload = JSON.parse(frame.data); } catch { continue; }

  if (frame.event === 'content_block_start' && payload?.content_block?.type === 'tool_use') {
    toolName = payload.content_block.name || toolName;
    toolId = payload.content_block.id || toolId;
  }
  if (frame.event === 'content_block_delta') {
    const delta = payload?.delta;
    if (delta?.type === 'input_json_delta') toolInputJson += delta.partial_json || '';
    if (delta?.type === 'text_delta') text += delta.text || '';
  }
  if (frame.event === 'message_delta') {
    stopReason = payload?.delta?.stop_reason || stopReason;
  }
}

const plan = readPlanFromJson(toolInputJson);
const textLeak = /<tool_call>|<\/tool_call>/i.test(result.raw) || /<tool_call>|<\/tool_call>/i.test(text);
const toolIdPrefix = toolId.slice(0, 6);
const failures = [];

if (toolName !== 'ExitPlanMode') failures.push(`toolName=${toolName || '<none>'}`);
if (!toolId.startsWith('toolu_')) failures.push(`toolId=${toolId || '<none>'}`);
if (!plan) failures.push('plan=<empty>');
if (stopReason !== 'tool_use') failures.push(`stopReason=${stopReason || '<none>'}`);
if (textLeak) failures.push('textLeak=true');

const summary = `status=${result.status} eventCount=${frames.length} toolName=${toolName || '<none>'} toolIdPrefix=${toolIdPrefix || '<none>'} planLength=${plan.length} stopReason=${stopReason || '<none>'} textLeak=${textLeak}`;

if (failures.length) {
  console.error(`FAIL PlanMode ${summary}`);
  console.error(`Failures: ${failures.join(', ')}`);
  process.exit(1);
}

console.log(`PASS PlanMode ${summary}`);
