import http from 'node:http';
import { readFileSync } from 'node:fs';
import { loadConfig, publicConfig } from './config.js';
import { isManagementAllowed } from './auth.js';
import { canProxy, proxyToPool, writeJson } from './proxy.js';
import { StatsStore } from './stats.js';
import { panelHtml, statusPayload } from './panel.js';
import { GATEWAY_LOG_PATH } from './paths.js';
import { log } from './logger.js';

const cfg = loadConfig();
const stats = new StatsStore();
const STARTED_AT = new Date().toISOString();
const API_ROUTES = [
  'GET /v1/models',
  'POST /v1/chat/completions',
  'POST /v1/responses',
  'POST /v1/messages',
];
const POOL_DASHBOARD_TIMEOUT_MS = 5000;

type PoolHealthResult = {
  ok: boolean;
  statusCode?: number;
  latencyMs: number;
  health?: unknown;
  error?: string;
};

class ManagementApiError extends Error {
  constructor(
    public statusCode: number,
    public type: string,
    message: string,
  ) {
    super(message);
    Object.setPrototypeOf(this, ManagementApiError.prototype);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function firstHeader(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function writeApiError(res: http.ServerResponse, status: number, message: string, type: string) {
  writeJson(res, status, { error: { message, type } });
}

function isAbortError(err: unknown): boolean {
  return isRecord(err) && err.name === 'AbortError';
}

function secretPreview(value: string): string {
  const s = value.trim();
  if (!s) return '';
  if (s.length <= 12) return '[redacted]';
  return `${s.slice(0, 6)}...${s.slice(-4)}`;
}

const SENSITIVE_FIELD_RE = /(?:api[-_]?key|password|secret|authorization|cookie|credential|csrf|refresh[-_]?token|access[-_]?token|id[-_]?token|auth[-_]?token|session[-_]?token|^token$)/i;

function isSecretLike(value: string): boolean {
  const s = value.trim();
  if (!s) return false;
  if (/^(?:Bearer\s+)?(?:devin-session-token\$|auth1_|sk-|wpa-)/i.test(s)) return true;
  if (/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?$/.test(s)) return true;
  return s.length >= 48 && /^[A-Za-z0-9._:$-]+$/.test(s);
}

function sanitizeForUi(value: unknown, fieldName = ''): unknown {
  if (typeof value === 'string') {
    if (SENSITIVE_FIELD_RE.test(fieldName) || isSecretLike(value)) {
      return secretPreview(value);
    }
    return value;
  }
  if (value === null || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForUi(item, fieldName));
  }
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      out[key] = SENSITIVE_FIELD_RE.test(key)
        ? (typeof child === 'string' && child.trim() ? secretPreview(child) : child ? '[redacted]' : child)
        : sanitizeForUi(child, key);
    }
    return out;
  }
  return null;
}

function optionalString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

function poolAccountSummary(account: unknown): Record<string, unknown> {
  if (!isRecord(account)) {
    return { value: sanitizeForUi(account) };
  }

  const apiKey = optionalString(account, 'apiKey') || optionalString(account, 'api_key');
  const refreshToken = optionalString(account, 'refreshToken') || optionalString(account, 'refresh_token');
  const idToken = optionalString(account, 'idToken') || optionalString(account, 'id_token');
  return {
    id: sanitizeForUi(account.id, 'id'),
    label: sanitizeForUi(account.label ?? account.email, 'label'),
    email: sanitizeForUi(account.email, 'email'),
    method: sanitizeForUi(account.method, 'method'),
    status: sanitizeForUi(account.status, 'status'),
    tier: sanitizeForUi(account.tier, 'tier'),
    planName: sanitizeForUi(account.planName, 'planName'),
    errorCount: sanitizeForUi(account.errorCount, 'errorCount'),
    lastUsed: sanitizeForUi(account.lastUsed, 'lastUsed'),
    addedAt: sanitizeForUi(account.addedAt, 'addedAt'),
    lastProbed: sanitizeForUi(account.lastProbed, 'lastProbed'),
    rateLimited: sanitizeForUi(account.rateLimited, 'rateLimited'),
    rateLimitedUntil: sanitizeForUi(account.rateLimitedUntil, 'rateLimitedUntil'),
    rpmUsed: sanitizeForUi(account.rpmUsed, 'rpmUsed'),
    rpmLimit: sanitizeForUi(account.rpmLimit, 'rpmLimit'),
    proxyEnabled: sanitizeForUi(account.proxyEnabled, 'proxyEnabled'),
    proxySummary: sanitizeForUi(account.proxySummary, 'proxySummary'),
    proxy: sanitizeForUi(account.proxy, 'proxy'),
    lsKey: sanitizeForUi(account.lsKey, 'lsKey'),
    apiKeyPreview: apiKey ? secretPreview(apiKey) : '',
    hasApiKey: Boolean(apiKey),
    hasRefreshToken: Boolean(refreshToken),
    hasIdToken: Boolean(idToken),
    credits: sanitizeForUi(account.credits, 'credits'),
    capabilities: sanitizeForUi(account.capabilities, 'capabilities'),
    blockedModels: sanitizeForUi(account.blockedModels, 'blockedModels'),
  };
}

function summarizePoolAccounts(payload: unknown, statusCode: number, latencyMs: number) {
  const accounts = isRecord(payload) && Array.isArray(payload.accounts)
    ? payload.accounts.map(poolAccountSummary)
    : [];
  const byStatus: Record<string, number> = {};
  for (const account of accounts) {
    const status = typeof account.status === 'string' && account.status ? account.status : 'unknown';
    byStatus[status] = (byStatus[status] ?? 0) + 1;
  }

  return {
    fetchedAt: new Date().toISOString(),
    upstream: {
      statusCode,
      latencyMs,
      dashboardUrl: cfg.pool.dashboardUrl,
    },
    total: accounts.length,
    active: byStatus.active ?? 0,
    byStatus,
    accounts,
  };
}

async function fetchPoolDashboardJson(path: string, managementKey: string): Promise<{ data: unknown; statusCode: number; latencyMs: number }> {
  const started = Date.now();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), POOL_DASHBOARD_TIMEOUT_MS);
  try {
    const res = await fetch(`${cfg.pool.baseUrl}${path}`, {
      signal: ac.signal,
      headers: {
        Accept: 'application/json',
        'X-Dashboard-Password': managementKey,
      },
    });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      throw new ManagementApiError(502, 'bad_gateway', 'Pool Dashboard returned invalid JSON.');
    }
    if (!res.ok) {
      throw new ManagementApiError(502, 'bad_gateway', `Pool Dashboard returned HTTP ${res.status}.`);
    }
    return { data, statusCode: res.status, latencyMs: Date.now() - started };
  } catch (err) {
    if (err instanceof ManagementApiError) throw err;
    if (isAbortError(err)) {
      throw new ManagementApiError(504, 'gateway_timeout', `Pool Dashboard timed out after ${Math.round(POOL_DASHBOARD_TIMEOUT_MS / 1000)}s.`);
    }
    throw new ManagementApiError(502, 'bad_gateway', 'Pool Dashboard is unavailable.');
  } finally {
    clearTimeout(timer);
  }
}

async function poolHealth(): Promise<PoolHealthResult> {
  const started = Date.now();
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 1200);
    const res = await fetch(`${cfg.pool.baseUrl}/health`, { signal: ac.signal });
    clearTimeout(timer);
    const health = await res.json().catch(() => ({ statusCode: res.status }));
    return {
      ok: res.ok,
      statusCode: res.status,
      latencyMs: Date.now() - started,
      health,
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function summarizePool(pool: PoolHealthResult) {
  if (!pool.ok || !isRecord(pool.health)) {
    return {
      ok: false,
      statusCode: pool.statusCode,
      latencyMs: pool.latencyMs,
      error: pool.error || 'Pool health unavailable',
      dashboardUrl: cfg.pool.dashboardUrl,
    };
  }
  const health = pool.health;
  const models = isRecord(health.models) ? health.models : null;
  const accountPool = isRecord(health.accountPool) ? health.accountPool : null;
  return {
    ok: true,
    statusCode: pool.statusCode,
    latencyMs: pool.latencyMs,
    dashboardUrl: cfg.pool.dashboardUrl,
    provider: health.provider,
    version: health.version,
    uptimeSeconds: health.uptimeSeconds,
    authenticated: health.authenticated,
    accounts: health.accounts,
    accountPool,
    models,
    recentErrors: Array.isArray(health.recentErrors) ? health.recentErrors : [],
  };
}

function gatewayHealth(pool: PoolHealthResult) {
  const snap = stats.snapshot();
  const poolSummary = summarizePool(pool);
  const modelCount = isRecord(poolSummary.models) && typeof poolSummary.models.total === 'number'
    ? poolSummary.models.total
    : null;
  return {
    status: poolSummary.ok ? 'ok' : 'degraded',
    gateway: {
      status: 'ok',
      pid: process.pid,
      startedAt: STARTED_AT,
      uptimeSeconds: Math.round(process.uptime()),
      routes: API_ROUTES,
    },
    pool: poolSummary,
    accounts: isRecord(poolSummary.accountPool)
      ? {
          total: poolSummary.accountPool.total,
          active: poolSummary.accountPool.active,
          usable: poolSummary.accountPool.usable,
          rateLimited: poolSummary.accountPool.rateLimited,
          quotaTight: poolSummary.accountPool.quotaTight,
          quotaExhausted: poolSummary.accountPool.quotaExhausted,
        }
      : null,
    models: {
      total: modelCount,
      summary: poolSummary.models,
    },
    stats: {
      startedAt: snap.startedAt,
      updatedAt: snap.updatedAt,
      totalRequests: snap.totalRequests,
      totalErrors: snap.totalErrors,
    },
    recentErrors: snap.recentErrors.slice(0, 10),
  };
}

async function requireManagement(req: http.IncomingMessage, res: http.ServerResponse): Promise<string | null> {
  const key = firstHeader(req.headers['x-management-key']);
  if (await isManagementAllowed(cfg, key)) return key;
  writeApiError(res, 401, 'Invalid management password', 'auth_error');
  return null;
}

function tailLog(): string[] {
  try {
    const content = readFileSync(GATEWAY_LOG_PATH, 'utf8');
    return content.trim().split(/\r?\n/).slice(-120);
  } catch {
    return [];
  }
}

const server = http.createServer(async (req, res) => {
  try {
  const method = req.method || 'GET';
  const url = new URL(req.url || '/', `http://${cfg.host}:${cfg.port}`);
  const path = url.pathname;

  if (method === 'OPTIONS') {
    writeJson(res, 204, {});
    return;
  }

  if (path === '/') {
    const html = panelHtml(cfg);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': Buffer.byteLength(html) });
    res.end(html);
    return;
  }

  if (path === '/health') {
    writeJson(res, 200, gatewayHealth(await poolHealth()));
    return;
  }

  if (path === '/pool-dashboard') {
    res.writeHead(302, { Location: cfg.pool.dashboardUrl });
    res.end();
    return;
  }

  if (path === '/api/status') {
    if (!(await requireManagement(req, res))) return;
    writeJson(res, 200, statusPayload(cfg, await poolHealth()));
    return;
  }

  if (path === '/api/stats') {
    if (!(await requireManagement(req, res))) return;
    writeJson(res, 200, stats.snapshot());
    return;
  }

  if (path === '/api/config') {
    if (!(await requireManagement(req, res))) return;
    writeJson(res, 200, publicConfig(cfg));
    return;
  }

  if (path === '/api/logs') {
    if (!(await requireManagement(req, res))) return;
    writeJson(res, 200, { lines: tailLog() });
    return;
  }

  if (path === '/api/secrets' && method === 'GET') {
    if (!(await requireManagement(req, res))) return;
    writeJson(res, 200, {
      apiKeys: cfg.apiKeys.map((value, index) => ({
        label: `Local API Key ${index + 1}`,
        value,
      })),
    });
    return;
  }

  if (path === '/api/pool/accounts' && method === 'GET') {
    const managementKey = await requireManagement(req, res);
    if (!managementKey) return;
    const result = await fetchPoolDashboardJson('/dashboard/api/accounts', managementKey);
    writeJson(res, 200, summarizePoolAccounts(result.data, result.statusCode, result.latencyMs));
    return;
  }

  if (canProxy(method, path)) {
    await proxyToPool(req, res, cfg, stats, path);
    return;
  }

  writeJson(res, 404, { error: { message: `${method} ${path} not found`, type: 'not_found' } });
  } catch (err) {
    if (res.headersSent) {
      res.end();
      return;
    }
    if (err instanceof ManagementApiError) {
      writeApiError(res, err.statusCode, err.message, err.type);
      return;
    }
    log('error', 'Gateway request handler error', { error: err instanceof Error ? err.message : String(err) });
    writeApiError(res, 500, 'Internal error', 'server_error');
  }
});

server.on('error', (err) => {
  log('error', 'Gateway server error', { error: err.message });
  process.exitCode = 1;
});

server.listen({ host: cfg.host, port: cfg.port }, () => {
  log('info', 'WindsurfProxyAPI gateway started', { host: cfg.host, port: cfg.port, pool: cfg.pool.baseUrl, pid: process.pid });
});
