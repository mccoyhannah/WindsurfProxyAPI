import bcrypt from 'bcryptjs';
import { AppConfig } from './config.js';

export function extractBearer(headers: NodeJS.Dict<string | string[] | undefined>): string {
  const xApiKey = headers['x-api-key'];
  if (typeof xApiKey === 'string' && xApiKey) return xApiKey;
  const auth = headers.authorization;
  const value = Array.isArray(auth) ? auth[0] : auth;
  if (!value) return '';
  return value.startsWith('Bearer ') ? value.slice('Bearer '.length).trim() : value.trim();
}

export function isApiKeyAllowed(cfg: AppConfig, key: string): boolean {
  return Boolean(key) && cfg.apiKeys.includes(key);
}

export async function isManagementAllowed(cfg: AppConfig, key: string): Promise<boolean> {
  if (!key) return false;
  return bcrypt.compare(key, cfg.remoteManagement.secretKey);
}
