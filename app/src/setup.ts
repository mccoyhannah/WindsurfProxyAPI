import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import bcrypt from 'bcryptjs';
import YAML from 'yaml';
import { ADMIN_CREDENTIALS_PATH, CONFIG_PATH, DATA_DIR, LOG_DIR, LS_BINARY_PATH, POOL_ENV_PATH, ROOT_DIR } from './paths.js';

function secret(prefix: string, bytes = 24): string {
  return `${prefix}${randomBytes(bytes).toString('hex')}`;
}

async function main() {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(LOG_DIR, { recursive: true });

  if (existsSync(CONFIG_PATH)) {
    console.log(`Config already exists: ${CONFIG_PATH}`);
    return;
  }

  const localApiKey = secret('wpa-local-');
  const poolApiKey = secret('wpa-pool-');
  const adminPassword = randomBytes(18).toString('base64url');
  const adminHash = await bcrypt.hash(adminPassword, 10);

  const config = {
    host: '127.0.0.1',
    port: 8327,
    pool: {
      host: '127.0.0.1',
      port: 8328,
      'base-url': 'http://127.0.0.1:8328',
      'dashboard-url': 'http://127.0.0.1:8328/dashboard',
      'api-key': poolApiKey,
    },
    'remote-management': {
      'allow-remote': false,
      'secret-key': adminHash,
    },
    'api-keys': [localApiKey],
    'proxy-url': '',
    'logging-to-file': true,
    'logs-max-total-size-mb': 50,
    runtime: {
      'language-server': LS_BINARY_PATH,
    },
    vendor: {
      pool: `${ROOT_DIR}\\vendor\\WindsurfPoolAPI`,
    },
  };

  writeFileSync(CONFIG_PATH, YAML.stringify(config), 'utf8');
  writeFileSync(ADMIN_CREDENTIALS_PATH, [
    'WindsurfProxyAPI first-run credentials',
    `panel_url=http://127.0.0.1:8327/`,
    `pool_dashboard_url=http://127.0.0.1:8328/dashboard`,
    `management_password=${adminPassword}`,
    `local_api_key=${localApiKey}`,
    `openai_base_url=http://127.0.0.1:8327/v1`,
    '',
  ].join('\n'), 'utf8');
  try { chmodSync(ADMIN_CREDENTIALS_PATH, 0o600); } catch {}
  if (!existsSync(POOL_ENV_PATH)) writeFileSync(POOL_ENV_PATH, '', 'utf8');
  console.log(`Created config: ${CONFIG_PATH}`);
  console.log(`Created credentials: ${ADMIN_CREDENTIALS_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
