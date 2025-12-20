
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
 * Tarik token ya29 dan reCAPTCHA paling segar dari Supabase.
 */
const getFreshTokensFromDB = async (): Promise<{ ya29: string | null, rec: string | null }> => {
    try {
        const userJson = localStorage.getItem('currentUser');
        if (!userJson) return { ya29: null, rec: null };
        
        const user = JSON.parse(userJson);
        if (!user || !user.id) return { ya29: null, rec: null };

        const { data, error } = await supabase
            .from('users')
            .select('personal_auth_token, recaptcha_token')
            .eq('id', user.id)
            .single();
            
        if (error || !data) return { ya29: null, rec: null };

        return { 
            ya29: data.personal_auth_token?.trim() || null, 
            rec: data.recaptcha_token?.trim() || null 
        };
    } catch (e) {
        return { ya29: null, rec: null };
    }
};

export const executeProxiedRequest = async (
  relativePath: string,
  serviceType: 'veo' | 'imagen' | 'nanobanana',
  requestBody: any,
  logContext: string,
  specificToken?: string,
  onStatusUpdate?: (status: string) => void,
  overrideServerUrl?: string
): Promise<{ data: any; successfulToken: string; successfulServerUrl: string }> => {
  const currentServerUrl = overrideServerUrl || (serviceType === 'veo' ? getVeoProxyUrl() : getImagenProxyUrl());
  const isGenerationRequest = logContext.includes('GENERATE') || logContext.includes('RECIPE') || logContext.includes('UPLOAD');
  
  if (isGenerationRequest && onStatusUpdate) onStatusUpdate('Fetching fresh activation keys...');
  
  const { ya29, rec } = await getFreshTokensFromDB();
  const finalYa29 = specificToken?.trim() || ya29;

  if (!finalYa29) throw new Error("Sesi tidak aktif. Sila jalankan Quantum Bridge di tab Google Labs.");

  // HEADERS: reCAPTCHA dihantar sebagai header, BUKAN dalam body JSON.
  const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${finalYa29}`,
      'X-User-Username': JSON.parse(localStorage.getItem('currentUser') || '{}').username || 'unknown'
  };

  if (rec) {
      headers['X-Recaptcha-Token'] = rec;
      console.log('🔐 [API Client] reCAPTCHA token attached to headers.');
  }

  try {
      if (isGenerationRequest && onStatusUpdate) onStatusUpdate('Processing...');
      
      const endpoint = `${currentServerUrl}/api/${serviceType}${relativePath}`;
      const response = await fetch(endpoint, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(requestBody),
      });

      const text = await response.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { error: { message: `Server Error (${response.status})` } }; }

      if (!response.ok) {
          if (response.status === 403 || text.includes('INVALID_RECAPTCHA') || text.includes('RECAPTCHA_REQUIRED')) {
              throw new Error("Handshake reCAPTCHA gagal. Sila jalankan aktivasi di tab Labs semula.");
          }
          throw new Error(data.error?.message || `API Error ${response.status}`);
      }

      return { data, successfulToken: finalYa29, successfulServerUrl: currentServerUrl };
  } catch (error: any) {
      addLogEntry({ 
          model: logContext, 
          prompt: 'Request Failed', 
          output: error.message, 
          tokenCount: 0, 
          status: 'Error', 
          error: error.message 
      });
      throw error;
  }
};
