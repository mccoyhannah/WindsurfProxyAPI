import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { IncomingMessage, ServerResponse } from 'node:http';
import { AppConfig } from './config.js';
import { extractBearer, isApiKeyAllowed } from './auth.js';
import { StatsStore } from './stats.js';
import { log } from './logger.js';

const PROXY_ROUTES = new Set([
  'GET /v1/models',
  'POST /v1/chat/completions',
  'POST /v1/messages',
  'POST /v1/responses',
]);
const POOL_IDLE_TIMEOUT_MS = 10 * 60 * 1000;

export function canProxy(method: string, path: string): boolean {
  return PROXY_ROUTES.has(`${method} ${path}`);
}

function firstHeader(value: string | string[] | undefined, fallback = ''): string {
  if (Array.isArray(value)) return value[0] || fallback;
  return value || fallback;
}

function setHeaderFallback(headers: http.OutgoingHttpHeaders, name: string, value: string) {
  const lower = name.toLowerCase();
  const exists = Object.keys(headers).some((key) => key.toLowerCase() === lower);
  if (!exists) headers[name] = value;
}

function addAnthropicHeaderFallbacks(
  headers: http.OutgoingHttpHeaders,
  req: IncomingMessage,
  traceId: string,
  path: string,
  includeRateLimitFallbacks = true,
) {
  if (path !== '/v1/messages') return;
  const reset = new Date(Date.now() + 60_000).toISOString();
  setHeaderFallback(headers, 'request-id', `req_${traceId.replace(/-/g, '')}`);
  setHeaderFallback(headers, 'anthropic-version', firstHeader(req.headers['anthropic-version'], '2023-06-01'));
  if (!includeRateLimitFallbacks) return;
  setHeaderFallback(headers, 'anthropic-ratelimit-requests-limit', '1000');
  setHeaderFallback(headers, 'anthropic-ratelimit-requests-remaining', '999');
  setHeaderFallback(headers, 'anthropic-ratelimit-requests-reset', reset);
  setHeaderFallback(headers, 'anthropic-ratelimit-tokens-limit', '200000');
  setHeaderFallback(headers, 'anthropic-ratelimit-tokens-remaining', '200000');
  setHeaderFallback(headers, 'anthropic-ratelimit-tokens-reset', reset);
  setHeaderFallback(headers, 'anthropic-ratelimit-input-tokens-limit', '200000');
  setHeaderFallback(headers, 'anthropic-ratelimit-input-tokens-remaining', '200000');
  setHeaderFallback(headers, 'anthropic-ratelimit-input-tokens-reset', reset);
  setHeaderFallback(headers, 'anthropic-ratelimit-output-tokens-limit', '8000');
  setHeaderFallback(headers, 'anthropic-ratelimit-output-tokens-remaining', '8000');
  setHeaderFallback(headers, 'anthropic-ratelimit-output-tokens-reset', reset);
}

export async function proxyToPool(req: IncomingMessage, res: ServerResponse, cfg: AppConfig, stats: StatsStore, path: string) {
  const started = Date.now();
  const traceId = randomUUID();
  const callerKey = extractBearer(req.headers);

  if (!isApiKeyAllowed(cfg, callerKey)) {
    const responseHeaders: http.OutgoingHttpHeaders = {};
    addAnthropicHeaderFallbacks(responseHeaders, req, traceId, path);
    const body = path === '/v1/messages'
      ? { type: 'error', error: { message: 'Invalid API key', type: 'authentication_error' } }
      : { error: { message: 'Invalid API key', type: 'auth_error' } };
    writeJson(res, 401, body, responseHeaders);
    stats.record({ apiKey: callerKey, route: path, method: req.method || 'GET', status: 401, durationMs: Date.now() - started, traceId });
    return;
  }

  const target = new URL(req.url || '/', cfg.pool.baseUrl);
  const headers: http.OutgoingHttpHeaders = { ...req.headers };
  headers.host = `${cfg.pool.host}:${cfg.pool.port}`;
  headers.authorization = `Bearer ${cfg.pool.apiKey}`;
  if (path === '/v1/messages' || headers['x-api-key']) headers['x-api-key'] = cfg.pool.apiKey;
  delete headers['content-length'];

  const upstream = http.request({
    hostname: cfg.pool.host,
    port: cfg.pool.port,
    method: req.method,
    path: `${target.pathname}${target.search}`,
    headers,
  }, (poolRes) => {
    req.socket?.setKeepAlive(true);
    req.setTimeout(0);
    res.socket?.setNoDelay(true);
    const responseHeaders: http.OutgoingHttpHeaders = { ...poolRes.headers, 'x-windsurfproxyapi-trace-id': traceId };
    addAnthropicHeaderFallbacks(responseHeaders, req, traceId, path, poolRes.statusCode !== 429);
    res.writeHead(poolRes.statusCode || 502, responseHeaders);
    poolRes.pipe(res);
    poolRes.on('end', () => {
      stats.record({
        apiKey: callerKey,
        route: path,
        method: req.method || 'GET',
        status: poolRes.statusCode || 502,
        durationMs: Date.now() - started,
        traceId,
      });
    });
  });

  upstream.on('socket', (socket) => {
    socket.setKeepAlive(true);
    socket.setNoDelay(true);
  });

  upstream.setTimeout(POOL_IDLE_TIMEOUT_MS, () => {
    upstream.destroy(new Error(`WindsurfPoolAPI timed out after ${Math.round(POOL_IDLE_TIMEOUT_MS / 1000)}s without activity`));
  });

  upstream.on('error', (err: Error) => {
    const timedOut = /timed out|timeout/i.test(err.message);
    const status = timedOut ? 504 : 502;
    const type = timedOut ? 'gateway_timeout' : 'bad_gateway';
    log('error', 'Pool proxy error', { traceId, route: path, error: err.message });
    if (!res.headersSent) {
      const responseHeaders: http.OutgoingHttpHeaders = {};
      addAnthropicHeaderFallbacks(responseHeaders, req, traceId, path);
      const body = path === '/v1/messages'
        ? { type: 'error', error: { message: timedOut ? 'WindsurfPoolAPI timed out' : 'WindsurfPoolAPI is unavailable', type: 'api_error' } }
        : { error: { message: timedOut ? 'WindsurfPoolAPI timed out' : 'WindsurfPoolAPI is unavailable', type, trace_id: traceId } };
      writeJson(res, status, body, responseHeaders);
    } else {
      res.end();
    }
    stats.record({
      apiKey: callerKey,
      route: path,
      method: req.method || 'GET',
      status,
      durationMs: Date.now() - started,
      traceId,
      errorMessage: err.message,
    });
  });

  req.pipe(upstream);
}

export function writeJson(res: ServerResponse, status: number, body: unknown, extraHeaders: http.OutgoingHttpHeaders = {}) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, anthropic-version, anthropic-beta, X-Management-Key',
    ...extraHeaders,
  });
  res.end(data);
}
