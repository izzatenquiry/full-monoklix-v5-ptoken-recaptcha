import { v4 as uuidv4 } from 'uuid';
import { executeProxiedRequest } from './apiClient';
import { cropImageToAspectRatio } from './imageService';

// Aspect ratio mapping for NanoBanana API
const aspectRatioApiMap: { [key: string]: string } = {
    "1:1": "IMAGE_ASPECT_RATIO_SQUARE",
    "16:9": "IMAGE_ASPECT_RATIO_LANDSCAPE",
    "9:16": "IMAGE_ASPECT_RATIO_PORTRAIT"
};

export interface NanoBananaConfig {
  sampleCount?: number;
  aspectRatio?: '1:1' | '9:16' | '16:9';
  negativePrompt?: string;
  seed?: number;
  authToken?: string;
  serverUrl?: string;
}

export interface NanoBananaGenerationRequest {
  prompt: string;
  config: NanoBananaConfig;
}

export interface NanoBananaRecipeMediaInput {
  caption: string;
  mediaInput: {
    mediaCategory: string;
    mediaGenerationId: string;
  };
}

/**
 * Upload image for NanoBanana processing
 */
export const uploadImageForNanoBanana = async (
    base64Image: string, 
    mimeType: string, 
    authToken?: string, 
    onStatusUpdate?: (status: string) => void,
    serverUrl?: string
): Promise<{ mediaId: string; successfulToken: string; successfulServerUrl: string }> => {
  console.log(`📤 [NanoBanana Service] Preparing to upload image. MimeType: ${mimeType}`);
  
  const requestBody = {
    clientContext: { 
      sessionId: `;${Date.now()}` 
    },
    imageInput: {
      rawImageBytes: base64Image,
      mimeType: mimeType,
    }
  };

  const { data, successfulToken, successfulServerUrl } = await executeProxiedRequest(
    '/upload',
    'nanobanana',
    requestBody, 
    'NANOBANANA UPLOAD', 
    authToken, 
    onStatusUpdate,
    serverUrl
  );

  const mediaId = 
    data.result?.data?.json?.result?.uploadMediaGenerationId || 
    data.mediaGenerationId?.mediaGenerationId || 
    data.mediaId;

  if (!mediaId) {
    console.error("No mediaId in response:", JSON.stringify(data, null, 2));
    throw new Error('Upload succeeded but no mediaId was returned from the proxy.');
  }
  
  console.log(`📤 [NanoBanana Service] Image upload successful. Media ID: ${mediaId} using token ...${successfulToken.slice(-6)}`);
  return { mediaId, successfulToken, successfulServerUrl };
};

/**
 * Generate image with NanoBanana Pro (Text-to-Image)
 */
export const generateImageWithNanoBanana = async (
  request: NanoBananaGenerationRequest, 
  onStatusUpdate?: (status: string) => void, 
  isHealthCheck = false
) => {
  console.log(`🍌 [NanoBanana Service] Preparing generateImageWithNanoBanana (T2I) request...`);
  const { prompt, config } = request;
  
  const fullPrompt = config.negativePrompt 
    ? `${prompt}, negative prompt: ${config.negativePrompt}` 
    : prompt;
  
  console.debug(`[NanoBanana T2I Prompt Sent]\n---\n${fullPrompt}\n---`);

  const requestBody = {
      clientContext: {
          tool: 'BACKBONE',
          sessionId: `;${Date.now()}`
      },
      imageModelSettings: {
          imageModel: 'NANOBANANA_PRO', // NanoBanana Pro model
          aspectRatio: aspectRatioApiMap[config.aspectRatio || '1:1'] || "IMAGE_ASPECT_RATIO_SQUARE",
      },
      prompt: fullPrompt,
      mediaCategory: 'MEDIA_CATEGORY_SCENE',
      seed: config.seed || Math.floor(Math.random() * 2147483647),
  };
  
  const logContext = isHealthCheck ? 'NANOBANANA HEALTH CHECK' : 'NANOBANANA GENERATE';
  console.log(`🍌 [NanoBanana Service] Sending T2I request to API client.`);
  
  const { data: result } = await executeProxiedRequest(
    '/generate',
    'nanobanana',
    requestBody,
    logContext,
    config.authToken,
    onStatusUpdate,
    config.serverUrl
  );

  console.log(`🍌 [NanoBanana Service] Received T2I result with ${result.imagePanels?.length || 0} panels.`);
  return result;
};

/**
 * Run image recipe with NanoBanana (Image-to-Image editing)
 */
export const runNanoBananaRecipe = async (
  request: {
    userInstruction: string;
    recipeMediaInputs: NanoBananaRecipeMediaInput[];
    config: Omit<NanoBananaConfig, 'negativePrompt'>;
  }, 
  onStatusUpdate?: (status: string) => void
) => {
    console.log(`✏️ [NanoBanana Service] Preparing runNanoBananaRecipe request with ${request.recipeMediaInputs.length} media inputs.`);
    const { userInstruction, recipeMediaInputs, config } = request;
    
    const requestBody = {
        clientContext: {
            tool: 'BACKBONE',
            sessionId: `;${Date.now()}`
        },
        seed: config.seed || Math.floor(Math.random() * 2147483647),
        imageModelSettings: {
            imageModel: 'NANOBANANA_R2I', // Recipe-based NanoBanana model
            aspectRatio: aspectRatioApiMap[config.aspectRatio || '1:1'] || "IMAGE_ASPECT_RATIO_SQUARE"
        },
        userInstruction,
        recipeMediaInputs
    };

    const { data: result } = await executeProxiedRequest(
      '/run-recipe',
      'nanobanana',
      requestBody,
      'NANOBANANA RECIPE',
      config.authToken,
      onStatusUpdate,
      config.serverUrl
    );
    
    console.log(`✏️ [NanoBanana Service] Received recipe result with ${result.imagePanels?.length || 0} panels.`);
    return result;
};

/**
 * Edit or compose images with NanoBanana
 */
export const editOrComposeWithNanoBanana = async (
  request: {
    prompt: string,
    images: { base64: string, mimeType: string, category: string, caption: string }[],
    config: NanoBananaConfig
  }, 
  onStatusUpdate?: (status: string) => void
) => {
    console.log(`🍌➡️✏️ [NanoBanana Service] Starting editOrComposeWithNanoBanana flow with ${request.images.length} images.`);
    console.debug(`[NanoBanana Edit/Compose Prompt Sent]\n---\n${request.prompt}\n---`);

    const uploadedMedia = [];
    let consistentToken: string | undefined = request.config.authToken;
    let consistentServer: string | undefined = request.config.serverUrl;

    // Upload all images
    for (let i = 0; i < request.images.length; i++) {
        const img = request.images[i];
        
        // Process image (resize/crop)
        let processedBase64 = img.base64;
        try {
            console.log(`🍌 [NanoBanana Service] Processing input image ${i + 1} (resize/crop)...`);
            processedBase64 = await cropImageToAspectRatio(img.base64, request.config.aspectRatio || '1:1');
        } catch (cropError) {
            console.warn(`⚠️ [NanoBanana Service] Failed to process image ${i + 1}, using original.`, cropError);
        }

        const { mediaId, successfulToken, successfulServerUrl } = await uploadImageForNanoBanana(
            processedBase64, 
            img.mimeType, 
            consistentToken, 
            onStatusUpdate,
            consistentServer
        );
        
        // Lock token/server for consistency
        if (!consistentToken) {
            consistentToken = successfulToken;
            consistentServer = successfulServerUrl;
            console.log(`🔒 [NanoBanana Service] Locked token: ...${consistentToken.slice(-6)} | Server: ${consistentServer}`);
        }

        uploadedMedia.push({
            caption: img.caption,
            mediaInput: { mediaCategory: img.category, mediaGenerationId: mediaId }
        });
    }

    console.log(`🍌➡️✏️ [NanoBanana Service] All images uploaded. Sending composed recipe request using locked token.`);
    
    // Run the recipe using consistent token
    const result = await runNanoBananaRecipe({
        userInstruction: request.prompt,
        recipeMediaInputs: uploadedMedia,
        config: {
            ...request.config,
            authToken: consistentToken,
            serverUrl: consistentServer
        }
    }, onStatusUpdate);
    
    return result;
};

/**
 * Test NanoBanana token health
 */
export const testNanoBananaToken = async (token: string, serverUrl?: string): Promise<boolean> => {
    if (!token) return false;
    
    try {
        console.log(`🍌 [NanoBanana Service] Testing token health...`);
        
        await generateImageWithNanoBanana({
            prompt: 'test',
            config: {
                aspectRatio: '1:1',
                authToken: token,
                serverUrl: serverUrl
            }
        }, undefined, true);
        
        console.log(`✅ [NanoBanana Service] Token test successful`);
        return true;
    } catch (error) {
        console.error(`❌ [NanoBanana Service] Token test failed:`, error);
        return false;
    }
};