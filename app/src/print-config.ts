import { loadConfig } from './config.js';
import { ADMIN_CREDENTIALS_PATH, APP_DIR, DATA_DIR, GATEWAY_LOG_PATH, LOG_DIR, LS_BINARY_PATH, POOL_ENV_PATH, ROOT_DIR, VENDOR_DIR } from './paths.js';

const cfg = loadConfig();
const includeSecrets = process.argv.includes('--include-secrets');
const REDACTED = '[redacted]';

function redactSecret(value: string | null | undefined): string {
  if (includeSecrets) return value ?? '';
  return value ? REDACTED : '';
}

function redactSecrets(values: string[]): string[] {
  if (includeSecrets) return values;
  return values.map(() => REDACTED);
}

console.log(JSON.stringify({
  secretsIncluded: includeSecrets,
  rootDir: ROOT_DIR,
  appDir: APP_DIR,
  vendorDir: VENDOR_DIR,
  dataDir: DATA_DIR,
  logDir: LOG_DIR,
  gatewayLogPath: GATEWAY_LOG_PATH,
  adminCredentialsPath: ADMIN_CREDENTIALS_PATH,
  poolEnvPath: POOL_ENV_PATH,
  lsBinaryPath: LS_BINARY_PATH,
  host: cfg.host,
  port: cfg.port,
  apiKeys: redactSecrets(cfg.apiKeys),
  proxyUrl: redactSecret(cfg.proxyUrl),
  pool: {
    host: cfg.pool.host,
    port: cfg.pool.port,
    baseUrl: cfg.pool.baseUrl,
    dashboardUrl: cfg.pool.dashboardUrl,
    apiKey: redactSecret(cfg.pool.apiKey),
  },
  loggingToFile: cfg.loggingToFile,
}, null, 2));
