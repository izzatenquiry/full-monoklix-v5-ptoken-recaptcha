
/**
 * reCAPTCHA Configuration for Monoklix VEO3 Integration
 * Uses Google's OFFICIAL site key from labs.google as provided in user files.
 */

export const DEFAULT_RECAPTCHA_SITE_KEY = '6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV';
export const RECAPTCHA_ACTION = 'PINHOLE_GENERATE'; // Match exactly with recaptcha-extractor.js

const SITE_KEY_STORAGE_KEY = 'monoklix_recaptcha_site_key';

export const getRecaptchaSiteKey = (): string => {
  return localStorage.getItem(SITE_KEY_STORAGE_KEY) || DEFAULT_RECAPTCHA_SITE_KEY;
};

// #FIX: Added missing setRecaptchaSiteKey function.
export const setRecaptchaSiteKey = (key: string) => {
  localStorage.setItem(SITE_KEY_STORAGE_KEY, key);
};

const memoryCache = new Map<string, { token: string; expiresAt: number }>();
const CACHE_TTL_MS = 10 * 1000; // 10 seconds cache (Matching the cache policy in user files)

export const cacheRecaptchaToken = (key: string, token: string) => {
  memoryCache.set(key, {
    token,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
};

export const getCachedRecaptchaToken = (key: string): string | undefined => {
  const cached = memoryCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.token;
  if (cached) memoryCache.delete(key);
  return undefined;
};

export const requestRecaptchaToken = async (): Promise<string> => {
  return new Promise((resolve, reject) => {
    const event = new CustomEvent('request-recaptcha', {
      detail: {
        onVerify: (token: string) => resolve(token),
        onCancel: () => reject(new Error('User cancelled security verification'))
      }
    });
    window.dispatchEvent(event);
  });
}