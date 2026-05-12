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
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return fallback;
}

function assertLoopback(name: string, host: string) {
  const normalized = host.trim().toLowerCase();
  if (normalized === '0.0.0.0' || normalized === '::' || normalized === '*') {
    throw new Error(`${name} must bind to 127.0.0.1 or localhost, not ${host}.`);
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

  assertLoopback('host', host);
  assertLoopback('pool.host', poolHost);

  const cfg: AppConfig = {
    host,
    port,
    pool: {
      host: poolHost,
      port: poolPort,
      baseUrl: poolBaseUrl.replace(/\/+$/, ''),
      apiKey: readString(pool['api-key'], ''),
      dashboardUrl: readString(pool['dashboard-url'], `${poolBaseUrl.replace(/\/+$/, '')}/dashboard`),
    },
    remoteManagement: {
      allowRemote: readBoolean(remoteManagement['allow-remote'], false),
      secretKey: readString(remoteManagement['secret-key'], ''),
    },
    apiKeys: Array.isArray(raw['api-keys']) ? raw['api-keys'].filter((x: unknown) => typeof x === 'string' && x) : [],
    proxyUrl: readString(raw['proxy-url'], ''),
    loggingToFile: readBoolean(raw['logging-to-file'], true),
    logsMaxTotalSizeMb: readNumber(raw['logs-max-total-size-mb'], 50),
  };

  if (!cfg.pool.apiKey) throw new Error('pool.api-key is required.');
  if (!cfg.remoteManagement.secretKey) throw new Error('remote-management.secret-key is required.');
  if (cfg.apiKeys.length === 0) throw new Error('api-keys must include at least one local key.');
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
