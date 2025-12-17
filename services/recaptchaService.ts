// services/recaptchaService.ts
// ✅ FINAL PRODUCTION VERSION - Uses Google's Official Site Key

/**
 * reCAPTCHA Configuration for Monoklix VEO3 Integration
 * 
 * CRITICAL: This uses Google's OFFICIAL site key from labs.google
 * This is the key that Google VEO API expects and validates!
 */

// ✅ Google's Official Site Key (from labs.google HAR analysis)
export const RECAPTCHA_SITE_KEY = '6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV';

export const RECAPTCHA_PROJECT_ID = 'gen-lang-client-0426593366';

/**
 * Token cache to avoid regenerating tokens too frequently
 * This is an in-memory cache for specific keys (e.g. linked to a Veo auth token)
 */
const memoryCache = new Map<string, { token: string; expiresAt: number }>();
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Cache a specific token for a short duration
 */
export const cacheRecaptchaToken = (key: string, token: string) => {
  memoryCache.set(key, {
    token,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
};

/**
 * Retrieve a cached token if valid
 */
export const getCachedRecaptchaToken = (key: string): string | undefined => {
  const cached = memoryCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    console.log(`🔄 Using cached reCAPTCHA token for key: ${key}`);
    return cached.token;
  }
  if (cached) {
    memoryCache.delete(key); // Expired
  }
  return undefined;
};

/**
 * Request a reCAPTCHA token via the UI Modal (RecaptchaProvider)
 * This dispatches a custom event that the React component listens for.
 */
export const requestRecaptchaToken = async (): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Create the custom event with callbacks for the UI to call
    const event = new CustomEvent('request-recaptcha', {
      detail: {
        onVerify: (token: string) => resolve(token),
        onCancel: () => reject(new Error('User cancelled reCAPTCHA verification'))
      }
    });
    
    // Dispatch to window so RecaptchaProvider can catch it
    window.dispatchEvent(event);
  });
};

// --- Legacy/Internal Functions below (kept for direct script usage if needed) ---

/**
 * Token cache for internal generateRecaptchaToken usage
 */
let internalCachedToken: string | null = null;
let tokenTimestamp: number = 0;

/**
 * Load reCAPTCHA Enterprise script
 */
export const loadRecaptchaScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.grecaptcha && window.grecaptcha.enterprise) {
      resolve();
      return;
    }

    // Check if script tag already exists
    if (document.querySelector(`script[src*="recaptcha/enterprise.js"]`)) {
      // Script loading, wait for it
      const checkInterval = setInterval(() => {
        if (window.grecaptcha && window.grecaptcha.enterprise) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('reCAPTCHA script load timeout'));
      }, 10000);
      return;
    }

    // Create and load script
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/enterprise.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      console.log('✅ reCAPTCHA Enterprise script loaded');
      // Wait for grecaptcha.enterprise to be available
      const checkReady = setInterval(() => {
        if (window.grecaptcha && window.grecaptcha.enterprise) {
          clearInterval(checkReady);
          resolve();
        }
      }, 50);
      
      setTimeout(() => {
        clearInterval(checkReady);
        if (window.grecaptcha && window.grecaptcha.enterprise) {
          resolve();
        } else {
          reject(new Error('grecaptcha.enterprise not available after script load'));
        }
      }, 5000);
    };

    script.onerror = () => {
      reject(new Error('Failed to load reCAPTCHA Enterprise script'));
    };

    document.head.appendChild(script);
  });
};

/**
 * Generate reCAPTCHA Enterprise token (Invisible/Background method)
 * Note: This might be blocked by browsers if not initiated by user action.
 * Prefer `requestRecaptchaToken` for high reliability.
 */
export const generateRecaptchaToken = async (action: string = 'submit'): Promise<string> => {
  // Check cache first
  const now = Date.now();
  if (internalCachedToken && (now - tokenTimestamp) < CACHE_TTL_MS) {
    console.log('🔄 Using cached reCAPTCHA token (internal)');
    return internalCachedToken;
  }

  try {
    // Ensure script is loaded
    await loadRecaptchaScript();

    if (!window.grecaptcha || !window.grecaptcha.enterprise) {
      throw new Error('reCAPTCHA Enterprise not available');
    }

    console.log('🔐 Generating reCAPTCHA Enterprise token...');
    
    const token = await window.grecaptcha.enterprise.execute(RECAPTCHA_SITE_KEY, { 
      action: action 
    });

    if (!token) {
      throw new Error('Failed to generate reCAPTCHA token');
    }

    // Cache the token
    internalCachedToken = token;
    tokenTimestamp = now;

    console.log('✅ reCAPTCHA Enterprise token generated');
    return token;

  } catch (error) {
    console.error('❌ reCAPTCHA token generation failed:', error);
    throw error;
  }
};

/**
 * Clear cached token (call this when user logs out or on error)
 */
export const clearRecaptchaCache = () => {
  internalCachedToken = null;
  tokenTimestamp = 0;
  memoryCache.clear();
  console.log('🧹 reCAPTCHA cache cleared');
};

/**
 * TypeScript declaration for grecaptcha
 */
declare global {
  interface Window {
    grecaptcha: {
      enterprise: {
        execute: (siteKey: string, options: { action: string }) => Promise<string>;
        ready: (callback: () => void) => void;
      };
    };
  }
}