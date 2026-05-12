import { loadConfig } from './config.js';
import { ADMIN_CREDENTIALS_PATH, APP_DIR, DATA_DIR, GATEWAY_LOG_PATH, LOG_DIR, LS_BINARY_PATH, POOL_ENV_PATH, ROOT_DIR, VENDOR_DIR } from './paths.js';

const cfg = loadConfig();
console.log(JSON.stringify({
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
  apiKeys: cfg.apiKeys,
  proxyUrl: cfg.proxyUrl,
  pool: cfg.pool,
  loggingToFile: cfg.loggingToFile,
}, null, 2));
