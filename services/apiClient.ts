
import { addLogEntry } from './aiLogService';
import { type User } from '../types';
import { supabase } from './supabaseClient';
import { PROXY_SERVER_URLS } from './serverConfig';

export const getVeoProxyUrl = (): string => {
  if (window.location.hostname === 'localhost') {
    return 'http://localhost:3001';
  }
  const userSelectedProxy = sessionStorage.getItem('selectedProxyServer');
  if (userSelectedProxy) {
      return userSelectedProxy;
  }
  return 'https://s1.monoklix.com';
};

export const getImagenProxyUrl = (): string => {
  if (window.location.hostname === 'localhost') {
    return 'http://localhost:3001';
  }
  const userSelectedProxy = sessionStorage.getItem('selectedProxyServer');
  if (userSelectedProxy) {
      return userSelectedProxy;
  }
  return 'https://s1.monoklix.com';
};

export const getNanoBananaProxyUrl = (): string => {
  return getImagenProxyUrl();
};

const getPersonalTokenLocal = (): { token: string; createdAt: string; } | null => {
    try {
        const userJson = localStorage.getItem('currentUser');
        if (userJson) {
            const user = JSON.parse(userJson);
            if (user && user.personalAuthToken && typeof user.personalAuthToken === 'string') {
                const cleanToken = user.personalAuthToken.trim();
                if (cleanToken.length > 0) {
                    return { token: cleanToken, createdAt: 'personal' };
                }
            }
        }
    } catch (e) {
        console.error("Could not parse user from localStorage to get personal token", e);
    }
    return null;
};

const getFreshPersonalTokenFromDB = async (): Promise<string | null> => {
    try {
        const userJson = localStorage.getItem('currentUser');
        if (!userJson) return null;
        
        const user = JSON.parse(userJson);
        if (!user || !user.id) return null;

        const { data, error } = await supabase
            .from('users')
            .select('personal_auth_token')
            .eq('id', user.id)
            .single();
            
        if (error) return null;

        if (data && data.personal_auth_token) {
            const cleanToken = data.personal_auth_token.trim();
            const updatedUser = { ...user, personalAuthToken: cleanToken };
            localStorage.setItem('currentUser', JSON.stringify(updatedUser));
            return cleanToken;
        }
    } catch (e) {
        console.error("[API Client] Exception refreshing token from DB", e);
    }
    return null;
};

const getCurrentUserInternal = (): User | null => {
    try {
        const savedUserJson = localStorage.getItem('currentUser');
        if (savedUserJson) {
            const user = JSON.parse(savedUserJson) as User;
            if (user && user.id) return user;
        }
    } catch (error) {}
    return null;
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
  const isStatusCheck = logContext === 'VEO STATUS';
  
  const currentServerUrl = overrideServerUrl || (
    serviceType === 'veo' 
      ? getVeoProxyUrl() 
      : serviceType === 'nanobanana'
        ? getNanoBananaProxyUrl()
        : getImagenProxyUrl()
  );
  
  const isGenerationRequest = logContext.includes('GENERATE') || logContext.includes('RECIPE');
  
  if (isGenerationRequest) {
    if (onStatusUpdate) onStatusUpdate('Queueing...');
    try {
        await supabase.rpc('request_generation_slot', { cooldown_seconds: 10, server_url: currentServerUrl });
    } catch (slotError) {}
    if (onStatusUpdate) onStatusUpdate('Processing...');
  }
  
  let rawToken = specificToken?.trim();
  let sourceLabel: 'Specific' | 'Personal' = 'Specific';

  if (!rawToken) {
      if (isGenerationRequest) {
          rawToken = await getFreshPersonalTokenFromDB() || undefined;
          sourceLabel = 'Personal';
      }
      if (!rawToken) {
          const personalLocal = getPersonalTokenLocal();
          if (personalLocal) {
              rawToken = personalLocal.token;
              sourceLabel = 'Personal';
          }
      }
  }

  if (!rawToken) {
      throw new Error(`Authentication failed: No Personal Token found. Sila gunakan 'Quantum Bridge' dalam Settings.`);
  }

  // LOGIK HIBRID V4: Pisahkan ya29 dan reCAPTCHA jika ada format [REC]
  let finalYa29 = rawToken;
  let syncedRecaptcha = null;
  
  if (rawToken.includes('[REC]')) {
      const parts = rawToken.split('[REC]');
      finalYa29 = parts[0].trim();
      syncedRecaptcha = parts[1].trim();
  }

  // Jika ini request Veo dan kita ada reCAPTCHA yang di-sync, masukkan ke body
  if (serviceType === 'veo' && syncedRecaptcha && !requestBody.recaptchaToken) {
      requestBody.recaptchaToken = syncedRecaptcha;
      console.log('🛡️ [API Client] Injecting Synced reCAPTCHA Token for Veo.');
  }

  const currentUser = getCurrentUserInternal();
  
  try {
      const endpoint = `${currentServerUrl}/api/${serviceType}${relativePath}`;
      
      const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${finalYa29}`,
              'x-user-username': currentUser?.username || 'unknown',
          },
          body: JSON.stringify(requestBody),
      });

      let data;
      const textResponse = await response.text();
      try {
          data = JSON.parse(textResponse);
      } catch {
          data = { error: { message: `Proxy error (${response.status})` } };
      }

      if (!response.ok) {
          const status = response.status;
          let errorMessage = data.error?.message || data.message || `API call failed (${status})`;
          throw new Error(errorMessage);
      }

      return { data, successfulToken: rawToken, successfulServerUrl: currentServerUrl };

  } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (!specificToken && !isStatusCheck && !errMsg.includes('400')) {
          addLogEntry({ 
              model: logContext, 
              prompt: `Failed using ${sourceLabel} token`, 
              output: errMsg, 
              tokenCount: 0, 
              status: 'Error', 
              error: errMsg 
          });
      }
      throw error;
  }
};
