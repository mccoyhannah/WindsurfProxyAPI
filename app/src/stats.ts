import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { STATS_PATH } from './paths.js';

export interface Stats {
  startedAt: string;
  updatedAt: string;
  totalRequests: number;
  totalErrors: number;
  byApiKey: Record<string, {
    label: string;
    total: number;
    errors: number;
    lastStatus: number;
    lastUsedAt: string;
    byStatus: Record<string, number>;
    byRoute: Record<string, number>;
  }>;
  recentErrors: Array<{
    ts: string;
    route: string;
    method: string;
    status: number;
    durationMs: number;
    traceId: string;
    message: string;
  }>;
}

function emptyStats(): Stats {
  const now = new Date().toISOString();
  return {
    startedAt: now,
    updatedAt: now,
    totalRequests: 0,
    totalErrors: 0,
    byApiKey: {},
    recentErrors: [],
  };
}

export class StatsStore {
  private stats: Stats;

  constructor() {
    this.stats = this.load();
  }

  snapshot(): Stats {
    return structuredClone(this.stats);
  }

  record(input: {
    apiKey?: string;
    route: string;
    method: string;
    status: number;
    durationMs: number;
    traceId: string;
    errorMessage?: string;
  }) {
    const now = new Date().toISOString();
    const keyHash = input.apiKey ? this.keyHash(input.apiKey) : 'anonymous';
    const label = input.apiKey ? this.keyLabel(input.apiKey) : 'anonymous';
    const bucket = this.stats.byApiKey[keyHash] ?? {
      label,
      total: 0,
      errors: 0,
      lastStatus: 0,
      lastUsedAt: '',
      byStatus: {},
      byRoute: {},
    };

    bucket.total += 1;
    bucket.lastStatus = input.status;
    bucket.lastUsedAt = now;
    bucket.byStatus[String(input.status)] = (bucket.byStatus[String(input.status)] ?? 0) + 1;
    bucket.byRoute[`${input.method} ${input.route}`] = (bucket.byRoute[`${input.method} ${input.route}`] ?? 0) + 1;

    this.stats.totalRequests += 1;
    if (input.status >= 400 || input.errorMessage) {
      bucket.errors += 1;
      this.stats.totalErrors += 1;
      this.stats.recentErrors.unshift({
        ts: now,
        route: input.route,
        method: input.method,
        status: input.status,
        durationMs: input.durationMs,
        traceId: input.traceId,
        message: input.errorMessage || `HTTP ${input.status}`,
      });
      this.stats.recentErrors = this.stats.recentErrors.slice(0, 50);
    }

    this.stats.byApiKey[keyHash] = bucket;
    this.stats.updatedAt = now;
    this.save();
  }

  private load(): Stats {
    try {
      if (!existsSync(STATS_PATH)) return emptyStats();
      return { ...emptyStats(), ...JSON.parse(readFileSync(STATS_PATH, 'utf8')) };
    } catch {
      return emptyStats();
    }
  }

  private save() {
    mkdirSync(dirname(STATS_PATH), { recursive: true });
    writeFileSync(STATS_PATH, JSON.stringify(this.stats, null, 2), 'utf8');
  }

  private keyHash(key: string): string {
    return createHash('sha256').update(key).digest('hex').slice(0, 16);
  }

  private keyLabel(key: string): string {
    if (key.length <= 16) return key;
    return `${key.slice(0, 10)}...${key.slice(-6)}`;
  }
}
