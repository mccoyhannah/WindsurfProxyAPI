import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = resolve(here, '..', '..');
export const APP_DIR = resolve(ROOT_DIR, 'app');
export const CONFIG_PATH = resolve(ROOT_DIR, 'config', 'config.yaml');
export const DATA_DIR = resolve(ROOT_DIR, 'data');
export const LOG_DIR = resolve(ROOT_DIR, 'logs');
export const STATS_PATH = resolve(DATA_DIR, 'stats.json');
export const GATEWAY_LOG_PATH = resolve(LOG_DIR, 'gateway.log');
export const ADMIN_CREDENTIALS_PATH = resolve(DATA_DIR, 'admin-credentials.txt');
export const VENDOR_DIR = resolve(ROOT_DIR, 'vendor', 'WindsurfPoolAPI');
export const POOL_ENV_PATH = resolve(VENDOR_DIR, '.env');
export const LS_BINARY_PATH = resolve(ROOT_DIR, 'runtime', 'language-server', 'language_server_windows_x64.exe');
