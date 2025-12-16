// recaptchaService.ts
// Service to manage reCAPTCHA flow for VEO3 video generation

// ✅ CRITICAL: Using Google labs.google official site key
// This is the PUBLIC key that Google VEO API expects
export const RECAPTCHA_SITE_KEY = '6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV'; 

/**
 * Shows reCAPTCHA modal and waits for user verification
 * Returns the reCAPTCHA token when user completes verification
 */
export const requestRecaptchaToken = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    // This will be handled by the RecaptchaModal component via RecaptchaProvider
    const event = new CustomEvent('request-recaptcha', {
      detail: {
        onVerify: (token: string) => {
          console.log('✅ reCAPTCHA token received:', token.substring(0, 20) + '...');
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
 * reCAPTCHA tokens typically expire after 2 minutes
 */
export const isRecaptchaTokenValid = (token: string, timestamp: number): boolean => {
  if (!token || !timestamp) return false;
  
  const TWO_MINUTES = 2 * 60 * 1000;
  const now = Date.now();
  
  return (now - timestamp) < TWO_MINUTES;
};

/**
 * Storage for recaptcha tokens (in-memory, per session)
 */
const recaptchaCache = new Map<string, { token: string; timestamp: number }>();

export const cacheRecaptchaToken = (key: string, token: string) => {
  recaptchaCache.set(key, {
    token,
    timestamp: Date.now()
  });
};

export const getCachedRecaptchaToken = (key: string): string | null => {
  const cached = recaptchaCache.get(key);
  if (!cached) return null;
  
  if (isRecaptchaTokenValid(cached.token, cached.timestamp)) {
    return cached.token;
  }
  
  // Remove expired token
  recaptchaCache.delete(key);
  return null;
};

export const clearRecaptchaCache = () => {
  recaptchaCache.clear();
};