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

type PoolHealthResult = {
  ok: boolean;
  statusCode?: number;
  latencyMs: number;
  health?: unknown;
  error?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

async function requireManagement(req: http.IncomingMessage, res: http.ServerResponse): Promise<boolean> {
  const header = req.headers['x-management-key'];
  const key = Array.isArray(header) ? header[0] : header;
  if (await isManagementAllowed(cfg, key || '')) return true;
  writeJson(res, 401, { error: { message: 'Invalid management password', type: 'auth_error' } });
  return false;
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

  if (canProxy(method, path)) {
    await proxyToPool(req, res, cfg, stats, path);
    return;
  }

  writeJson(res, 404, { error: { message: `${method} ${path} not found`, type: 'not_found' } });
});

server.on('error', (err) => {
  log('error', 'Gateway server error', { error: err.message });
  process.exitCode = 1;
});

server.listen({ host: cfg.host, port: cfg.port }, () => {
  log('info', 'WindsurfProxyAPI gateway started', { host: cfg.host, port: cfg.port, pool: cfg.pool.baseUrl, pid: process.pid });
});
