/**
 * Centralized configuration for AI models.
 * This separates model names from the application logic, making it easier
 * to update or swap models in the future without changing service code.
 */
export const MODELS = {
  text: 'gemini-2.5-flash',
  imageGeneration: 'imagen-4.0-generate-001',
  imageGenerationNanoBanana: 'nanobanana-pro', // NEW: NanoBanana Pro model
  imageEdit: 'IMAGEN_RECIPE', // Represents all Imagen V3 recipe-based edits
  imageEditNanoBanana: 'NANOBANANA_RECIPE', // NEW: NanoBanana recipe-based edits
  videoGenerationDefault: 'veo-3.1-fast-generate-001',
  videoGenerationOptions: [
    { id: 'veo-3.1-fast-generate-001', label: 'Veo 3 (Fast)' },
    { id: 'veo-3.1-generate-001', label: 'Veo 3 (Standard)' },
  ],
  imageGenerationOptions: [
    { id: 'imagen', label: 'Imagen 4', description: 'Google\'s advanced image model' },
    { id: 'nanobanana', label: 'NanoBanana Pro', description: 'Creative community model', icon: '🍌' },
  ],
};