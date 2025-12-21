
/**
 * Utility to parse cookie files and extract authentication tokens for Google Services.
 * Supports:
 * 1. Raw Text / Python Script Output (containing ya29. tokens)
 * 2. JSON format (EditThisCookie, Cookie-Editor)
 * 3. Netscape HTTP Cookie File format (cookies.txt)
 * 
 * PRIORITY:
 * 1. Any string starting with 'ya29.' found ANYWHERE in the file.
 * 2. __SESSION (Firebase/Cloud token)
 * 3. __Secure-next-auth.session-token (Next.js App session - fallback)
 */

export const parseCookieFile = async (file: File): Promise<string | null> => {
    try {
        const text = await file.text();
        
        // 1. GLOBAL REGEX SCAN (Highest Priority)
        // Look for the token pattern `ya29.` followed by valid Base64URL characters.
        // This allows handling the Python script output or raw text files instantly.
        const ya29Regex = /(ya29\.[a-zA-Z0-9_-]+)/;
        const match = text.match(ya29Regex);
        
        if (match && match[0]) {
            console.log(`[CookieUtils] Found Google Access Token (ya29) via global scan.`);
            return match[0];
        }

        // 2. Try parsing as JSON (Fallback for other token types)
        try {
            const jsonCookies = JSON.parse(text);
            if (Array.isArray(jsonCookies)) {
                // Priority 2: __SESSION
                const sessionCookie = jsonCookies.find((c: any) => c.name === '__SESSION');
                if (sessionCookie && sessionCookie.value) {
                    return sessionCookie.value;
                }

                // Priority 3: NextAuth
                const nextAuthCookie = jsonCookies.find((c: any) => c.name === '__Secure-next-auth.session-token');
                if (nextAuthCookie && nextAuthCookie.value) {
                    return nextAuthCookie.value;
                }
            }
        } catch (e) {
            // Not JSON, continue to Netscape format
        }

        // 3. Try parsing as Netscape format (Tab separated)
        const lines = text.split('\n');
        let sessionCandidate: string | null = null;
        let nextAuthCandidate: string | null = null;

        for (const line of lines) {
            if (line.startsWith('#') || !line.trim()) continue;
            
            const parts = line.split('\t');
            if (parts.length >= 7) {
                const name = parts[5];
                const value = parts[6].trim();

                if (name === '__SESSION') sessionCandidate = value;
                if (name === '__Secure-next-auth.session-token') nextAuthCandidate = value;
            }
        }

        // Return candidates based on priority
        if (sessionCandidate) return sessionCandidate;
        if (nextAuthCandidate) return nextAuthCandidate;

        return null;
    } catch (error) {
        console.error("Failed to parse cookie file:", error);
        throw new Error("Invalid cookie file format.");
    }
};
