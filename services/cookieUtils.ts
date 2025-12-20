
/**
 * Utility to parse cookie files and extract authentication tokens for Google Services.
 * Optimized to handle Python script output, JSON exports, and Netscape formats.
 * 
 * PRIORITY:
 * 1. Global Scan for 'ya29.' (Handles raw text/log files instantly)
 * 2. __SESSION (Official Firebase/Cloud Session)
 * 3. Fallback to session tokens
 */

export const parseCookieFile = async (file: File): Promise<string | null> => {
    try {
        const text = await file.text();
        
        // 1. GLOBAL REGEX SCAN (Paling penting untuk fail anda)
        // Mencari sebarang string bermula dengan 'ya29.' dalam fail teks
        const ya29Regex = /(ya29\.[a-zA-Z0-9_-]+)/;
        const match = text.match(ya29Regex);
        
        if (match && match[0]) {
            console.log(`[CookieUtils] Token ya29 dikesan melalui imbasan global.`);
            return match[0];
        }

        // 2. Try parsing as JSON (Extension exports)
        try {
            const jsonCookies = JSON.parse(text);
            if (Array.isArray(jsonCookies)) {
                const sessionCookie = jsonCookies.find((c: any) => c.name === '__SESSION');
                if (sessionCookie && sessionCookie.value) return sessionCookie.value;
                
                const nextAuthCookie = jsonCookies.find((c: any) => c.name === '__Secure-next-auth.session-token');
                if (nextAuthCookie && nextAuthCookie.value) return nextAuthCookie.value;
            }
        } catch (e) {
            // Bukan JSON, teruskan ke format lain
        }

        // 3. Try parsing as Netscape format (Tab separated cookies.txt)
        const lines = text.split('\n');
        for (const line of lines) {
            if (line.startsWith('#') || !line.trim()) continue;
            const parts = line.split('\t');
            if (parts.length >= 7) {
                const name = parts[5];
                const value = parts[6].trim();
                if (name === '__SESSION') return value;
            }
        }

        return null;
    } catch (error) {
        console.error("Gagal membaca fail kuki:", error);
        throw new Error("Format fail tidak dikenali.");
    }
};
