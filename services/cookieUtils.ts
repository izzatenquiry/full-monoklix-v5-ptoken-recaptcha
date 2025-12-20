
/**
 * Utility to parse files and extract Google Access Tokens (ya29).
 * Enhanced with Deep Recursive Inspection to replicate Python logic.
 */

const YA29_REGEX = /ya29\.[a-zA-Z0-9_-]{50,}/g;
const JWT_REGEX = /ey[a-zA-Z0-9_-]+\.ey[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g;

/**
 * Decodes a JWT payload without verification.
 */
const decodeJwtPayload = (token: string): any => {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        
        let payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const pad = payloadBase64.length % 4;
        if (pad) {
            if (pad === 1) return null;
            payloadBase64 += new Array(5 - pad).join('=');
        }

        return JSON.parse(atob(payloadBase64));
    } catch {
        return null;
    }
};

/**
 * Recursively searches any object or value for a ya29 token.
 * This handles nested JSON and JWTs within JSON.
 */
const findYa29Deep = (data: any): string | null => {
    if (typeof data === 'string') {
        // 1. Check if direct ya29
        if (data.startsWith('ya29.')) return data;
        
        // 2. Check if it's a JWT that might contain ya29
        if (data.startsWith('ey') && data.includes('.')) {
            const payload = decodeJwtPayload(data);
            if (payload) {
                const foundInJwt = findYa29Deep(payload);
                if (foundInJwt) return foundInJwt;
            }
        }
        
        // 3. Regex fallback for strings that contain ya29 mixed with other text
        const match = data.match(/ya29\.[a-zA-Z0-9_-]{50,}/);
        if (match) return match[0];

    } else if (Array.isArray(data)) {
        for (const item of data) {
            const found = findYa29Deep(item);
            if (found) return found;
        }
    } else if (data !== null && typeof data === 'object') {
        for (const key in data) {
            // Check keys like 'accessToken' specifically (Python logic)
            if (['accessToken', 'access_token', 'token', 'bearerToken', 'value'].includes(key)) {
                const val = data[key];
                if (typeof val === 'string' && val.startsWith('ya29.')) return val;
            }
            
            const found = findYa29Deep(data[key]);
            if (found) return found;
        }
    }
    return null;
};

export const parseCookieFile = async (file: File): Promise<string | null> => {
    try {
        const text = await file.text();
        console.log(`[DeepExtractor] Memulakan imbasan fail: ${file.name} (${text.length} bytes)`);

        // LANGKAH 1: Global Regex Search (Paling Pantas)
        const globalMatches = text.match(YA29_REGEX);
        if (globalMatches && globalMatches.length > 0) {
            console.log("[DeepExtractor] Token ya29 dijumpai melalui Global Regex.");
            return globalMatches[0].trim();
        }

        // LANGKAH 2: Percubaan JSON Parsing & Deep Search
        try {
            const jsonData = JSON.parse(text);
            const found = findYa29Deep(jsonData);
            if (found) {
                console.log("[DeepExtractor] Token ya29 dijumpai melalui Deep JSON Search.");
                return found.trim();
            }
        } catch (e) {
            // Bukan fail JSON, teruskan ke langkah seterusnya
        }

        // LANGKAH 3: Cari corak JWT dalam teks mentah dan bedah payload
        const jwtMatches = text.match(JWT_REGEX);
        if (jwtMatches) {
            console.log(`[DeepExtractor] Menjumpai ${jwtMatches.length} corak JWT. Membedah payload...`);
            for (const jwt of jwtMatches) {
                const payload = decodeJwtPayload(jwt);
                const found = findYa29Deep(payload);
                if (found) return found.trim();
            }
        }

        console.warn("[DeepExtractor] Gagal menemui sebarang token ya29 yang sah.");
        return null;
    } catch (error) {
        console.error("[DeepExtractor] Ralat kritikal:", error);
        throw new Error("Gagal membaca fail atau format data rosak.");
    }
};
