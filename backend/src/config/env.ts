import crypto from 'crypto';

/**
 * Central place for secrets and security settings. Nothing sensitive is hardcoded:
 * everything comes from environment variables (see backend/.env.example).
 */
const KNOWN_WEAK_SECRETS = ['pvpsit_secret_key_change_in_production_123!', 'changeme', 'secret'];
const isProduction = () => process.env.NODE_ENV === 'production';

let cachedSecret: string | null = null;

export const getJwtSecret = (): string => {
  if (cachedSecret) return cachedSecret;
  const secret = process.env.JWT_SECRET;
  const weak = !secret || secret.length < 32 || KNOWN_WEAK_SECRETS.some(w => secret.includes(w.slice(0, 17)));

  if (!weak) {
    cachedSecret = secret as string;
  } else if (isProduction()) {
    throw new Error('JWT_SECRET is missing, too short (<32 chars) or a known default. Set a strong random value in backend/.env.');
  } else {
    // Development only: a random per-process secret. Logins reset on every restart.
    console.warn('[security] JWT_SECRET is missing or weak - using a temporary random secret (everyone is logged out on restart). Set a strong JWT_SECRET in backend/.env.');
    cachedSecret = crypto.randomBytes(48).toString('hex');
  }
  return cachedSecret;
};

export const getJwtExpiry = (): string => process.env.JWT_EXPIRY || '12h';

/** Comma-separated list in CORS_ORIGINS. Unset = allow all in development, none in production. */
export const getAllowedOrigins = (): string[] | '*' => {
  const raw = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (raw.length) return raw;
  if (isProduction()) return [];
  return '*';
};

export const corsOrigin = (): any => {
  const allowed = getAllowedOrigins();
  if (allowed === '*') return true; // reflect request origin (development / LAN)
  return (origin: string | undefined, cb: (err: Error | null, ok?: boolean) => void) =>
    cb(null, !origin || allowed.includes(origin));
};

/** Throws early at startup so a misconfigured production server never runs. */
export const assertSecurityConfig = (): void => {
  getJwtSecret();
  if (isProduction() && getAllowedOrigins() !== '*' && (getAllowedOrigins() as string[]).length === 0) {
    console.warn('[security] CORS_ORIGINS is empty in production - cross-origin browser requests will be blocked.');
  }
};

export const MIN_PASSWORD_LENGTH = 8;
