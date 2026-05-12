import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { GATEWAY_LOG_PATH } from './paths.js';

type Meta = Record<string, unknown>;

function clean(meta: Meta = {}): Meta {
  const out: Meta = {};
  for (const [key, value] of Object.entries(meta)) {
    if (/token|password|secret|api[-_]?key|authorization/i.test(key)) {
      out[key] = '[redacted]';
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function log(level: 'info' | 'warn' | 'error', message: string, meta: Meta = {}) {
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    message,
    ...clean(meta),
  });
  try {
    mkdirSync(dirname(GATEWAY_LOG_PATH), { recursive: true });
    appendFileSync(GATEWAY_LOG_PATH, entry + '\n', 'utf8');
  } catch {
    // Logging must never break the gateway.
  }
  if (level === 'error') console.error(entry);
  else if (level === 'warn') console.warn(entry);
  else console.log(entry);
}
