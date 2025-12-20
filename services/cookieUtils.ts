
/**
 * Utility to parse files and extract Google Access Tokens (ya29).
 * Optimized to perform deep JWT decoding to find the inner token 
 * as seen in Google Flow Labs session cookies.
 */

const YA29_REGEX = /ya29\.[a-zA-Z0-9_-]{50,}/;

/**
 * Decodes a JWT payload without verification
 */
const decodeJwtPayload = (token: string): any => {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        // The payload is the second part
        let payload = parts[1];
        
        // Fix base64 padding
        payload = payload.replace(/-/g, '+').replace(/_/g, '/');
        const pad = payload.length % 4;
        if (pad) {
            if (pad === 1) return null;
            payload += new Array(5 - pad).join('=');
        }

        const decoded = JSON.parse(atob(payload));
        return decoded;
    } catch (e) {
        console.error("[CookieUtils] JWT Decode failed:", e);
        return null;
    }
};

export const parseCookieFile = async (file: File): Promise<string | null> => {
    try {
        const text = await file.text();
        
        // 1. STRATEGY: Try to find ya29 directly first (Regex)
        const directMatch = text.match(YA29_REGEX);
        if (directMatch) {
            console.log(`[CookieUtils] Direct ya29 token detected.`);
            return directMatch[0];
        }

        // 2. STRATEGY: Handle JSON structures (Session/Cookie exports)
        try {
            const data = JSON.parse(text);
            const cookies = Array.isArray(data) ? data : (data.cookies || []);
            
            // Look for the specific session token cookie used by Flow Labs
            // This replicates the Python script's logic
            const sessionCookie = cookies.find((c: any) => 
                c.name === '__Secure-next-auth.session-token' || 
                c.key === '__Secure-next-auth.session-token'
            );

            if (sessionCookie && sessionCookie.value) {
                console.log("[CookieUtils] Session JWT found. Attempting deep extraction...");
                const payload = decodeJwtPayload(sessionCookie.value);
                
                if (payload) {
                    const innerToken = payload.accessToken || payload.access_token || payload.token || payload.bearerToken;
                    if (innerToken && innerToken.startsWith('ya29.')) {
                        console.log("[CookieUtils] Inner ya29 token extracted from JWT payload.");
                        return innerToken;
                    }
                }
            }

            // Fallback: Recursive search in JSON for any string starting with ya29
            const findYa29InObject = (obj: any): string | null => {
                if (typeof obj === 'string' && obj.startsWith('ya29.')) return obj;
                if (typeof obj === 'object' && obj !== null) {
                    for (const key in obj) {
                        const found = findYa29InObject(obj[key]);
                        if (found) return found;
                    }
                }
                return null;
            };

            const foundInJson = findYa29InObject(data);
            if (foundInJson) return foundInJson;

        } catch (e) {
            // Not a valid JSON, move to raw text fallback
        }

        // 3. FALLBACK: Search entire raw text for a JWT, then decode it
        // This handles cases where a JWT is pasted into a .txt file
        const jwtRegex = /ey[a-zA-Z0-9_-]+\.ey[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g;
        const jwtMatches = text.match(jwtRegex);
        
        if (jwtMatches) {
            for (const jwt of jwtMatches) {
                const payload = decodeJwtPayload(jwt);
                if (payload) {
                    const innerToken = payload.accessToken || payload.access_token || payload.token;
                    if (innerToken && innerToken.startsWith('ya29.')) return innerToken;
                }
            }
        }

        return null;
    } catch (error) {
        console.error("[CookieUtils] File processing error:", error);
        throw new Error("Gagal membaca fail atau format tidak sah.");
    }
};
