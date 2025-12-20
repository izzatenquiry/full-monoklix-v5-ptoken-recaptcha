
/**
 * reCAPTCHA Configuration for Monoklix VEO3 Integration (Web Version)
 * Menggunakan data yang di-sync melalui Quantum Bridge V6.
 */

export const DEFAULT_RECAPTCHA_SITE_KEY = '6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV';
export const RECAPTCHA_ACTION = 'PINHOLE_GENERATE'; 

const memoryCache = new Map<string, { token: string; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

export const getRecaptchaSiteKey = (): string => DEFAULT_RECAPTCHA_SITE_KEY;

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

/**
 * Dalam versi WEB, kita tidak boleh menjana token reCAPTCHA secara automatik 
 * merentasi domain. Fungsi ini akan memberitahu UI untuk meminta pengguna
 * menjalankan semula skrip Quantum Bridge di tab Google Labs.
 */
export const requestRecaptchaToken = async (): Promise<string> => {
  console.warn('🔐 [RecaptchaService] reCAPTCHA renewal required via Quantum Bridge.');
  
  // Throw error spesifik supaya UI boleh tunjukkan mesej "Sila jalankan semula skrip Bridge"
  throw new Error('RECAPTCHA_SYNC_REQUIRED');
}
