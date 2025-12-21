
import { addLogEntry } from './aiLogService';
import { type User } from '../types';
import { supabase } from './supabaseClient';
import { PROXY_SERVER_URLS } from './serverConfig';

export const getVeoProxyUrl = (): string => {
  const userSelectedProxy = sessionStorage.getItem('selectedProxyServer');
  return userSelectedProxy || 'https://s1.monoklix.com';
};

export const getImagenProxyUrl = (): string => {
  const userSelectedProxy = sessionStorage.getItem('selectedProxyServer');
  return userSelectedProxy || 'https://s1.monoklix.com';
};

export const getNanoBananaProxyUrl = (): string => getImagenProxyUrl();

/**
 * Tarik token paling segar dari Supabase sebelum memulakan request.
 * reCAPTCHA biasanya expired dlm 2 minit (TTL ikut kod Electron).
 */
const getFreshTokensFromDB = async (): Promise<{ ya29: string | null, rec: string | null, username: string }> => {
    try {
        const userJson = localStorage.getItem('currentUser');
        if (!userJson) return { ya29: null, rec: null, username: 'unknown' };
        
        const user = JSON.parse(userJson);
        if (!user || !user.id) return { ya29: null, rec: null, username: 'unknown' };

        // Tarik terus dari DB untuk elak data basi dlm localStorage
        const { data, error } = await supabase
            .from('users')
            .select('personal_auth_token, recaptcha_token, username')
            .eq('id', user.id)
            .single();
            
        if (error) {
            console.error("❌ [Supabase Error] Gagal tarik token dari DB:", error.message);
            // Jika error 42703 (column missing), beritahu user dlm console
            if (error.message.includes('column') || error.message.includes('recaptcha_token')) {
                console.warn("⚠️ Column 'recaptcha_token' tidak dikesan dlm Supabase. Sila jalankan ALTER TABLE dlm SQL Editor.");
            }
            return { ya29: null, rec: null, username: user.username || 'unknown' };
        }

        return { 
            ya29: data.personal_auth_token?.trim() || null, 
            rec: data.recaptcha_token?.trim() || null,
            username: data.username || 'unknown'
        };
    } catch (e) {
        return { ya29: null, rec: null, username: 'unknown' };
    }
};

export const executeProxiedRequest = async (
  relativePath: string,
  serviceType: 'veo' | 'imagen' | 'nanobanana',
  requestBody: any,
  logContext: string,
  specificToken?: string, // Fallback
  onStatusUpdate?: (status: string) => void,
  overrideServerUrl?: string
): Promise<{ data: any; successfulToken: string; successfulServerUrl: string }> => {
  const currentServerUrl = overrideServerUrl || (serviceType === 'veo' ? getVeoProxyUrl() : getImagenProxyUrl());
  const isGenerationRequest = logContext.includes('GENERATE') || logContext.includes('RECIPE') || logContext.includes('UPLOAD');
  
  if (isGenerationRequest && onStatusUpdate) onStatusUpdate('Neural Handshake...');
  
  // Ambil data token terkini dari database
  const { ya29, rec, username } = await getFreshTokensFromDB();
  
  // Gunakan ya29 dari DB, kalau takda baru guna parameter fallback
  const finalYa29 = ya29 || specificToken?.trim();

  if (!finalYa29) {
      throw new Error("Sesi Aktif Tidak Dijumpai. Sila jalankan skrip Quantum Bridge di Settings.");
  }

  // HEADERS: Selaras dengan logic Proxy MONOklix
  const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${finalYa29}`,
      'X-User-Username': username
  };

  // Lampirkan token reCAPTCHA jika ada dlm DB
  if (rec) {
      headers['X-Recaptcha-Token'] = rec;
      console.log(`🔐 [Quantum Handshake] Dikesan. Menghantar verifikasi ke Proxy.`);
  }

  try {
      if (isGenerationRequest && onStatusUpdate) onStatusUpdate('Processing via Proxy...');
      
      const endpoint = `${currentServerUrl}/api/${serviceType}${relativePath}`;
      const response = await fetch(endpoint, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(requestBody),
      });

      const text = await response.text();
      let data;
      try {
          data = JSON.parse(text);
      } catch {
          data = { error: { message: `Server Error (${response.status})` } };
      }

      if (!response.ok) {
          // Handle ralat reCAPTCHA basi (ikut status 403 dlm flow Google Labs)
          if (response.status === 403 && (text.includes('INVALID_RECAPTCHA') || text.includes('RECAPTCHA_REQUIRED') || text.includes('RECAPTCHA_VALIDATION_FAILED'))) {
              throw new Error("Handshake Basi. Sila jalankan skrip Quantum Bridge dlm Settings dan tekan Save.");
          }
          throw new Error(data.error?.message || data.error || `API Error ${response.status}`);
      }

      return { data, successfulToken: finalYa29, successfulServerUrl: currentServerUrl };
  } catch (error: any) {
      addLogEntry({ 
          model: logContext, 
          prompt: 'Quantum Handshake Request', 
          output: error.message, 
          tokenCount: 0, 
          status: 'Error', 
          error: error.message 
      });
      throw error;
  }
};
