import { existsSync, readFileSync } from 'node:fs';
import YAML from 'yaml';
import { CONFIG_PATH, LS_BINARY_PATH, ROOT_DIR, VENDOR_DIR } from './paths.js';

export interface AppConfig {
  host: string;
  port: number;
  pool: {
    host: string;
    port: number;
    baseUrl: string;
    apiKey: string;
    dashboardUrl: string;
  };
  remoteManagement: {
    allowRemote: boolean;
    secretKey: string;
  };
  apiKeys: string[];
  proxyUrl: string;
  loggingToFile: boolean;
  logsMaxTotalSizeMb: number;
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function readNumber(value: unknown, fallback: number): number {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'number' && typeof value !== 'string') return Number.NaN;
  if (typeof value === 'string' && !value.trim()) return fallback;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : Number.NaN;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return fallback;
}

function readStringArray(name: string, value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be a non-empty array of strings.`);
  }
  if (value.length === 0) {
    throw new Error(`${name} must include at least one local key.`);
  }

  return value.map((item, index) => {
    if (typeof item !== 'string' || !item.trim()) {
      throw new Error(`${name}[${index}] must be a non-empty string.`);
    }
    return item.trim();
  });
}

function assertPort(name: string, port: number) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be an integer between 1 and 65535, got ${port}.`);
  }
}

function assertLoopback(name: string, host: string) {
  const normalized = host.trim().toLowerCase().replace(/^\[(.*)\]$/, '$1');
  const isLocalhost = normalized === 'localhost';
  const isIpv6Loopback = normalized === '::1';
  const ipv4 = normalized.split('.');
  const isIpv4Loopback = ipv4.length === 4
    && ipv4[0] === '127'
    && ipv4.every((part) => /^\d+$/.test(part) && Number(part) >= 0 && Number(part) <= 255);

  if (!isLocalhost && !isIpv6Loopback && !isIpv4Loopback) {
    throw new Error(`${name} must be a loopback host (127.0.0.1, 127.x.x.x, ::1, or localhost), got "${host}".`);
  }
}

function readHttpUrl(name: string, value: string, requireLoopback = false): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL, got "${value}".`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${name} must use http:// or https://, got "${value}".`);
  }
  if (!url.hostname) {
    throw new Error(`${name} must include a host, got "${value}".`);
  }
  if (requireLoopback) {
    assertLoopback(`${name} host`, url.hostname);
  }
  return value.replace(/\/+$/, '');
}

function assertProxyUrl(name: string, value: string) {
  if (!value) return;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a parseable URL such as http://127.0.0.1:7890, got "${value}".`);
  }
  if (!url.protocol || !url.hostname) {
    throw new Error(`${name} must include a scheme and host, got "${value}".`);
  }
}

export function loadConfig(): AppConfig {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error(`Missing config file: ${CONFIG_PATH}. Run: node app/dist/setup.js`);
  }

  const raw = YAML.parse(readFileSync(CONFIG_PATH, 'utf8')) ?? {};
  const pool = raw.pool ?? {};
  const remoteManagement = raw['remote-management'] ?? {};
  const host = readString(raw.host, '127.0.0.1');
  const port = readNumber(raw.port, 8327);
  const poolHost = readString(pool.host, '127.0.0.1');
  const poolPort = readNumber(pool.port, 8328);
  const poolBaseUrl = readString(pool['base-url'], `http://${poolHost}:${poolPort}`);
  const normalizedPoolBaseUrl = readHttpUrl('pool.base-url', poolBaseUrl, true);

  assertLoopback('host', host);
  assertLoopback('pool.host', poolHost);
  assertPort('port', port);
  assertPort('pool.port', poolPort);

  const cfg: AppConfig = {
    host,
    port,
    pool: {
      host: poolHost,
      port: poolPort,
      baseUrl: normalizedPoolBaseUrl,
      apiKey: readString(pool['api-key'], ''),
      dashboardUrl: readHttpUrl('pool.dashboard-url', readString(pool['dashboard-url'], `${normalizedPoolBaseUrl}/dashboard`), true),
    },
    remoteManagement: {
      allowRemote: readBoolean(remoteManagement['allow-remote'], false),
      secretKey: readString(remoteManagement['secret-key'], ''),
    },
    apiKeys: readStringArray('api-keys', raw['api-keys']),
    proxyUrl: readString(raw['proxy-url'], ''),
    loggingToFile: readBoolean(raw['logging-to-file'], true),
    logsMaxTotalSizeMb: readNumber(raw['logs-max-total-size-mb'], 50),
  };

  if (!cfg.pool.apiKey) throw new Error('pool.api-key is required.');
  if (!cfg.remoteManagement.secretKey) throw new Error('remote-management.secret-key is required.');
  assertProxyUrl('proxy-url', cfg.proxyUrl);
  return cfg;
}

export function publicConfig(cfg: AppConfig) {
  return {
    rootDir: ROOT_DIR,
    vendorDir: VENDOR_DIR,
    host: cfg.host,
    port: cfg.port,
    baseUrl: `http://${cfg.host}:${cfg.port}`,
    pool: {
      host: cfg.pool.host,
      port: cfg.pool.port,
      baseUrl: cfg.pool.baseUrl,
      dashboardUrl: cfg.pool.dashboardUrl,
    },
    apiKeyCount: cfg.apiKeys.length,
    proxyUrl: cfg.proxyUrl ? '(configured)' : '',
    loggingToFile: cfg.loggingToFile,
    lsBinaryPath: LS_BINARY_PATH,
  };
}
