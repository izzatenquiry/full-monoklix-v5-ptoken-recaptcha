
import { v4 as uuidv4 } from 'uuid';
import { executeProxiedRequest } from './apiClient';
import { requestRecaptchaToken, cacheRecaptchaToken, getCachedRecaptchaToken } from './recaptchaService';

interface Veo3Config {
  authToken: string;
  aspectRatio: 'landscape' | 'portrait';
  seed?: number;
  useStandardModel?: boolean;
  serverUrl?: string;
  recaptchaToken?: string;
}

interface VideoGenerationRequest {
  prompt: string;
  imageMediaId?: string;
  config: Omit<Veo3Config, 'authToken'> & { authToken?: string };
}

export const generateVideoWithVeo3 = async (
    request: VideoGenerationRequest,
    onStatusUpdate?: (status: string) => void,
    isHealthCheck = false
): Promise<{ operations: any[]; successfulToken: string; successfulServerUrl: string }> => {
  const { prompt, imageMediaId, config } = request;
  const isImageToVideo = !!imageMediaId;

  let videoModelKey: string;
  if (isImageToVideo) {
    videoModelKey = config.aspectRatio === 'landscape' ? 'veo_3_1_i2v_s_fast_ultra' : 'veo_3_1_i2v_s_fast_portrait_ultra';
  } else {
    videoModelKey = config.aspectRatio === 'landscape' ? 'veo_3_1_t2v_fast_ultra' : 'veo_3_1_t2v_fast_portrait_ultra';
  }

  const seed = config.seed || Math.floor(Math.random() * 2147483647);
  const requestBody: any = {
    clientContext: { tool: 'PINHOLE', userPaygateTier: 'PAYGATE_TIER_TWO' },
    requests: [{
      aspectRatio: config.aspectRatio === 'landscape' ? 'VIDEO_ASPECT_RATIO_LANDSCAPE' : 'VIDEO_ASPECT_RATIO_PORTRAIT',
      seed: seed,
      textInput: { prompt },
      videoModelKey: videoModelKey,
      metadata: { sceneId: uuidv4() }
    }]
  };

  if (imageMediaId) requestBody.requests[0].startImage = { mediaId: imageMediaId };

  // reCAPTCHA Cache Check (Logic from your files)
  const cacheKey = `recaptcha_${config.authToken || 'default'}`;
  let token = config.recaptchaToken || getCachedRecaptchaToken(cacheKey);

  if (token) {
    requestBody.recaptchaToken = token;
  }

  const relativePath = isImageToVideo ? '/generate-i2v' : '/generate-t2v';
  
  try {
    const { data, successfulToken, successfulServerUrl } = await executeProxiedRequest(
      relativePath,
      'veo',
      requestBody,
      isHealthCheck ? 'VEO HEALTH' : 'VEO GENERATE',
      config.authToken, 
      onStatusUpdate,
      config.serverUrl
    );
    
    return { operations: data.operations || [], successfulToken, successfulServerUrl };
  } catch (error: any) {
    const errorMsg = error.message || '';
    
    // Check for RECAPTCHA_REQUIRED (Status 403 or specific string)
    if (errorMsg.includes('RECAPTCHA_REQUIRED') || error.status === 403) {
      console.warn('🔐 Google Security Check Triggered. Requesting fresh token...');
      if (onStatusUpdate) onStatusUpdate('Security verification required...');
      
      try {
        // Trigger the manual/silent reCAPTCHA flow matching your PINHOLE_GENERATE logic
        const newToken = await requestRecaptchaToken();
        cacheRecaptchaToken(cacheKey, newToken);
        
        // Retry logic exactly like in your provided files
        requestBody.recaptchaToken = newToken;
        if (onStatusUpdate) onStatusUpdate('Verification successful. Retrying...');
        
        const retry = await executeProxiedRequest(
          relativePath, 'veo', requestBody, 'VEO RETRY', 
          config.authToken, onStatusUpdate, config.serverUrl
        );
        return { operations: retry.data.operations || [], successfulToken: retry.successfulToken, successfulServerUrl: retry.successfulServerUrl };
      } catch (recaptchaErr) {
          console.error('Security verification failed:', recaptchaErr);
          throw new Error('Security verification failed or was cancelled.');
      }
    }
    throw error;
  }
};

export const checkVideoStatus = async (operations: any[], token: string, onStatusUpdate?: (status: string) => void, serverUrl?: string) => {
  const { data } = await executeProxiedRequest('/status', 'veo', { operations }, 'VEO STATUS', token, onStatusUpdate, serverUrl);
  return data;
};

export const uploadImageForVeo3 = async (base64Image: string, mimeType: string, aspectRatio: 'landscape' | 'portrait', onStatusUpdate?: (status: string) => void, authToken?: string, serverUrl?: string): Promise<{ mediaId: string; successfulToken: string; successfulServerUrl: string }> => {
  const requestBody = {
    imageInput: { rawImageBytes: base64Image, mimeType: mimeType, isUserUploaded: true, aspectRatio: aspectRatio === 'landscape' ? 'IMAGE_ASPECT_RATIO_LANDSCAPE' : 'IMAGE_ASPECT_RATIO_PORTRAIT' },
    clientContext: { sessionId: uuidv4(), tool: 'ASSET_MANAGER' }
  };
  const { data, successfulToken, successfulServerUrl } = await executeProxiedRequest('/upload', 'veo', requestBody, 'VEO UPLOAD', authToken, onStatusUpdate, serverUrl);
  const mediaId = data.mediaGenerationId?.mediaGenerationId || data.mediaId;
  if (!mediaId) throw new Error('Upload failed: No mediaId returned');
  return { mediaId, successfulToken, successfulServerUrl };
};
