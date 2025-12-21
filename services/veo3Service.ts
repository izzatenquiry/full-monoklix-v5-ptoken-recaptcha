
import { v4 as uuidv4 } from 'uuid';
import { executeProxiedRequest } from './apiClient';

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
): Promise<{ operations: any[]; successfulToken: string; successfulServerUrl: string; requiresRecaptcha?: boolean }> => {
  const { prompt, imageMediaId, config } = request;
  const isImageToVideo = !!imageMediaId;

  let videoModelKey: string;
  if (isImageToVideo) {
    videoModelKey = config.aspectRatio === 'landscape' ? 'veo_3_1_i2v_s_fast_ultra' : 'veo_3_1_i2v_s_fast_portrait_ultra';
  } else {
    videoModelKey = config.aspectRatio === 'landscape' ? 'veo_3_1_t2v_fast_ultra' : 'veo_3_1_t2v_fast_portrait_ultra';
  }

  const requestBody: any = {
    clientContext: {
      tool: 'PINHOLE',
      userPaygateTier: 'PAYGATE_TIER_TWO',
      // CRITICAL: Letakkan token di sini
      recaptchaToken: config.recaptchaToken || undefined
    },
    requests: [{
      aspectRatio: config.aspectRatio === 'landscape' ? 'VIDEO_ASPECT_RATIO_LANDSCAPE' : 'VIDEO_ASPECT_RATIO_PORTRAIT',
      seed: config.seed || Math.floor(Math.random() * 2147483647),
      textInput: { prompt },
      videoModelKey: videoModelKey,
      metadata: { sceneId: uuidv4() }
    }]
  };

  if (imageMediaId) {
    requestBody.requests[0].startImage = { mediaId: imageMediaId };
  }

  const relativePath = isImageToVideo ? '/generate-i2v' : '/generate-t2v';
  const logContext = isHealthCheck ? 'VEO HEALTH' : 'VEO GENERATE';
  
  try {
    const { data, successfulToken, successfulServerUrl } = await executeProxiedRequest(
      relativePath,
      'veo',
      requestBody,
      logContext,
      config.authToken, 
      onStatusUpdate,
      config.serverUrl
    );
    
    return { operations: data.operations || [], successfulToken, successfulServerUrl, requiresRecaptcha: false };
  } catch (error: any) {
    const errorMsg = error.message || '';
    if (errorMsg.includes('RECAPTCHA_REQUIRED') || errorMsg.includes('403')) {
      return { operations: [], successfulToken: config.authToken || '', successfulServerUrl: config.serverUrl || '', requiresRecaptcha: true };
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
  if (!mediaId) throw new Error('Upload succeeded but no mediaId returned');
  return { mediaId, successfulToken, successfulServerUrl };
};
