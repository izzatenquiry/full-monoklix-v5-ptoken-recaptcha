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
  // Default if nothing selected - Use s11 (your current server)
  return 'https://s11.monoklix.com';
};

export const getImagenProxyUrl = (): string => {
  if (window.location.hostname === 'localhost') {
    return 'http://localhost:3001';
  }
  const userSelectedProxy = sessionStorage.getItem('selectedProxyServer');
  if (userSelectedProxy) {
      return userSelectedProxy;
  }
  return 'https://s11.monoklix.com';
};

const getPersonalTokenLocal = (): { token: string; createdAt: string; } | null => {
    try {
        const userJson = localStorage.getItem('currentUser');
        if (userJson) {
            const user = JSON.parse(userJson);
            if (user && user.personalAuthToken && typeof user.personalAuthToken === 'string' && user.personalAuthToken.trim().length > 0) {
                return { token: user.personalAuthToken, createdAt: 'personal' };
            }
        }
    } catch (e) {
        console.error("Could not parse user from localStorage to get personal token", e);
    }
    return null;
};

// Fallback: Fetch fresh token from DB if missing locally
const getFreshPersonalTokenFromDB = async (): Promise<string | null> => {
    try {
        const userJson = localStorage.getItem('currentUser');
        if (!userJson) {
            console.warn('[API Client] No currentUser in localStorage');
            return null;
        }
        
        const user = JSON.parse(userJson);
        if (!user || !user.id) {
            console.warn('[API Client] User object invalid or missing ID');
            return null;
        }

        console.log(`[API Client] Fetching token for user ${user.id} from DB...`);
        const { data, error } = await supabase
            .from('users')
            .select('personal_auth_token')
            .eq('id', user.id)
            .single();
            
        if (error) {
            console.error('[API Client] Supabase error fetching token:', error);
            return null;
        }

        if (data && data.personal_auth_token) {
            // Update local storage to prevent future fetches
            const updatedUser = { ...user, personalAuthToken: data.personal_auth_token };
            localStorage.setItem('currentUser', JSON.stringify(updatedUser));
            console.log('[API Client] Refreshed personal token from DB and updated localStorage.');
            return data.personal_auth_token;
        } else {
            console.warn('[API Client] DB query returned no token (null/empty).');
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
            if (user && user.id) {
                return user;
            }
        }
    } catch (error) {
        console.error("Failed to parse user from localStorage for activity log.", error);
    }
    return null;
};

// --- EXECUTE REQUEST (STRICT PERSONAL TOKEN ONLY) ---

export const executeProxiedRequest = async (
  relativePath: string,
  serviceType: 'veo' | 'imagen',
  requestBody: any,
  logContext: string,
  specificToken?: string,
  onStatusUpdate?: (status: string) => void,
  overrideServerUrl?: string
): Promise<{ data: any; successfulToken: string; successfulServerUrl: string }> => {
  const isStatusCheck = logContext === 'VEO STATUS';
  
  if (!isStatusCheck) {
      console.log(`[API Client] Starting process for: ${logContext}`);
  }
  
  // Use override URL if provided, otherwise default to standard proxy selection
  const currentServerUrl = overrideServerUrl || (serviceType === 'veo' ? getVeoProxyUrl() : getImagenProxyUrl());
  
  // 1. Acquire Server Slot (Rate Limiting at Server Level)
  const isGenerationRequest = logContext.includes('GENERATE') || logContext.includes('RECIPE');
  
  if (isGenerationRequest) {
    if (onStatusUpdate) onStatusUpdate('Queueing...');
    try {
        await supabase.rpc('request_generation_slot', { cooldown_seconds: 10, server_url: currentServerUrl });
    } catch (slotError) {
        console.warn('Slot request failed, proceeding anyway:', slotError);
    }
    if (onStatusUpdate) onStatusUpdate('Processing...');
  }
  
  // 2. Resolve Token
  let finalToken = specificToken;
  let sourceLabel: 'Specific' | 'Personal' = 'Specific';

  if (!finalToken) {
      // Step A: Check Local Storage
      const personalLocal = getPersonalTokenLocal();
      if (personalLocal) {
          finalToken = personalLocal.token;
          sourceLabel = 'Personal';
      } 
      
      // Step B: If local missing, check Database
      if (!finalToken) {
          const freshToken = await getFreshPersonalTokenFromDB();
          if (freshToken) {
              finalToken = freshToken;
              sourceLabel = 'Personal';
          }
      }
  }

  if (!finalToken) {
      console.error(`[API Client] Authentication failed. No token found in LocalStorage or DB.`);
      throw new Error(`Authentication failed: No Personal Token found. Please go to Settings > Token & API and set your token.`);
  }

  // DEBUG: Log token info (for VEO requests only)
  if (serviceType === 'veo' && !isStatusCheck) {
      console.log(`🔑 [API Client] Using Auth Token (Personal): ...${finalToken.slice(-8)}`);
      console.log(`🔑 [API Client] Token length: ${finalToken.length}`);
  }

  const currentUser = getCurrentUserInternal();
  
  // 4. Execute
  try {
      const endpoint = `${currentServerUrl}/api/${serviceType}${relativePath}`;
      
      // Build headers explicitly
      const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${finalToken}`,
          'x-user-username': currentUser?.username || 'unknown',
      };
      
      // DEBUG: Log headers (for VEO requests only)
      if (serviceType === 'veo' && !isStatusCheck) {
          console.log(`📤 [API Client] Request headers:`, {
              'Content-Type': headers['Content-Type'],
              'Authorization': `Bearer ${finalToken.substring(0, 20)}...`,
              'x-user-username': headers['x-user-username']
          });
      }
      
      const response = await fetch(endpoint, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(requestBody),
      });

      let data;
      const textResponse = await response.text();
      try {
          data = JSON.parse(textResponse);
      } catch {
          data = { error: { message: `Proxy returned non-JSON (${response.status}): ${textResponse.substring(0, 100)}` } };
      }

      if (!response.ok) {
          const status = response.status;
          let errorMessage = data.error?.message || data.message || `API call failed (${status})`;
          const lowerMsg = errorMessage.toLowerCase();

          // Check for reCAPTCHA requirement
          if (data.error === 'RECAPTCHA_REQUIRED' || errorMessage.toLowerCase().includes('recaptcha')) {
              console.warn(`🔐 [API Client] reCAPTCHA verification required`);
              throw { requiresRecaptcha: true, originalError: data };
          }

          // Check for hard errors
          if (status === 400 || lowerMsg.includes('safety') || lowerMsg.includes('blocked')) {
              console.warn(`[API Client] 🛑 Non-retriable error (${status}). Prompt issue.`);
              throw new Error(`[${status}] ${errorMessage}`);
          }
          
          throw new Error(errorMessage);
      }

      if (!isStatusCheck) {
          console.log(`✅ [API Client] Success using ${sourceLabel} token on ${currentServerUrl}`);
      }
      return { data, successfulToken: finalToken, successfulServerUrl: currentServerUrl };

  } catch (error) {
      // Re-throw reCAPTCHA requirement
      if (error && typeof error === 'object' && 'requiresRecaptcha' in error) {
          throw error;
      }

      const errMsg = error instanceof Error ? error.message : String(error);
      const isSafetyError = errMsg.includes('[400]') || errMsg.toLowerCase().includes('safety') || errMsg.toLowerCase().includes('blocked');

      if (!specificToken && !isSafetyError && !isStatusCheck) {
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