// recaptchaService.ts
// Service to manage reCAPTCHA Enterprise flow for VEO3 video generation

/**
 * CRITICAL CONFIGURATION:
 * ========================
 * This site key is for reCAPTCHA ENTERPRISE (not v3 standard)
 * 
 * Required Setup in Google Cloud Console:
 * 1. Go to: https://console.cloud.google.com/security/recaptcha
 * 2. Select project: gen-lang-client-0426593366
 * 3. Ensure this site key is configured as "reCAPTCHA Enterprise"
 * 4. Add authorized domains: monoklix.com, dev.monoklix.com, *.monoklix.com
 * 5. Enable reCAPTCHA Enterprise API in the project
 * 
 * The server validates tokens using the same OAuth credentials
 * that are used for VEO API calls - no separate API key needed.
 */
export const RECAPTCHA_SITE_KEY = '6LenAy4sAAAAAAAAH5gx8yT_maqcg-vpDDLmyZQj5M'; 
export const RECAPTCHA_PROJECT_ID = 'gen-lang-client-0426593366';

/**
 * Shows reCAPTCHA Enterprise modal and waits for user verification
 * Returns the reCAPTCHA Enterprise token when user completes verification
 * 
 * This token will be validated server-side using reCAPTCHA Enterprise API
 * before being sent to Google's VEO API
 */
export const requestRecaptchaToken = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    // This will be handled by the RecaptchaModal component via RecaptchaProvider
    const event = new CustomEvent('request-recaptcha', {
      detail: {
        onVerify: (token: string) => {
          console.log('✅ reCAPTCHA Enterprise token received');
          resolve(token);
        },
        onCancel: () => {
          reject(new Error('reCAPTCHA verification cancelled by user'));
        }
      }
    });
    
    window.dispatchEvent(event);
  });
};

/**
 * Validates if a recaptcha token is still valid (not expired)
 * reCAPTCHA Enterprise tokens typically expire after 2 minutes
 */
export const isRecaptchaTokenValid = (token: string, timestamp: number): boolean => {
  if (!token || !timestamp) return false;
  
  const TWO_MINUTES = 2 * 60 * 1000;
  const now = Date.now();
  
  return (now - timestamp) < TWO_MINUTES;
};

/**
 * Storage for recaptcha tokens (in-memory, per session)
 * Tokens are cached to avoid unnecessary re-verification
 */
const recaptchaCache = new Map<string, { token: string; timestamp: number }>();

export const cacheRecaptchaToken = (key: string, token: string) => {
  recaptchaCache.set(key, {
    token,
    timestamp: Date.now()
  });
  console.log(`📦 Cached reCAPTCHA token for key: ${key}`);
};

export const getCachedRecaptchaToken = (key: string): string | null => {
  const cached = recaptchaCache.get(key);
  if (!cached) {
    console.log(`❌ No cached reCAPTCHA token for key: ${key}`);
    return null;
  }
  
  if (isRecaptchaTokenValid(cached.token, cached.timestamp)) {
    console.log(`✅ Using cached reCAPTCHA token for key: ${key}`);
    return cached.token;
  }
  
  // Remove expired token
  console.log(`⚠️ Cached reCAPTCHA token expired for key: ${key}`);
  recaptchaCache.delete(key);
  return null;
};

export const clearRecaptchaCache = () => {
  console.log('🗑️ Clearing all cached reCAPTCHA tokens');
  recaptchaCache.clear();
};

/**
 * Generate a cache key for reCAPTCHA tokens based on context
 * This helps avoid redundant verification for similar requests
 */
export const generateRecaptchaCacheKey = (prefix: string, context: any): string => {
  // Simple key generation - can be enhanced based on needs
  return `${prefix}_${JSON.stringify(context)}`;
};