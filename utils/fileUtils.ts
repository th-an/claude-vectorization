/**
 * Pristine Full-Resolution File Reader (Token Optimizer Disabled)
 * Delivers uncompressed, full-native-resolution image payloads to Claude
 * for maximum vector precision, anatomical detail, and hand-drawn fidelity.
 */

export type SupportedVlmMimeType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

export interface ProcessedImageResult {
  data: string;
  mimeType: SupportedVlmMimeType;
}

/**
 * Normalizes any MIME type or file extension to one of the 4 strict formats accepted by Anthropic & OpenAI:
 * 'image/jpeg', 'image/png', 'image/webp', 'image/gif'
 */
export function normalizeVlmMimeType(mime: string, filename?: string): SupportedVlmMimeType {
  const cleanMime = (mime || '').toLowerCase().trim();
  const ext = filename ? filename.split('.').pop()?.toLowerCase() : '';

  if (cleanMime === 'image/jpeg' || cleanMime === 'image/jpg' || ext === 'jpg' || ext === 'jpeg') {
    return 'image/jpeg';
  }
  if (cleanMime === 'image/webp' || ext === 'webp') {
    return 'image/webp';
  }
  if (cleanMime === 'image/gif' || ext === 'gif') {
    return 'image/gif';
  }
  return 'image/png';
}

/**
 * Ingests image at 100% native resolution without token compression downscaling.
 * Ensures the VLM sees every minute detail, eyelash, hair texture, ink line, and subtle gradient.
 */
export const processImageForVlm = (file: File): Promise<ProcessedImageResult> => {
  return new Promise((resolve) => {
    const rawMime = (file.type || '').toLowerCase();

    // 1. If already a supported raster format (PNG, JPEG, WebP, GIF), read raw 100% native bytes directly
    if (
      rawMime === 'image/png' ||
      rawMime === 'image/jpeg' ||
      rawMime === 'image/jpg' ||
      rawMime === 'image/webp' ||
      rawMime === 'image/gif'
    ) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        resolve({
          data: result.split(',')[1],
          mimeType: normalizeVlmMimeType(rawMime, file.name),
        });
      };
      reader.onerror = () => {
        resolve({ data: '', mimeType: 'image/png' });
      };
      return;
    }

    // 2. If SVG or other vector/bitmap format, rasterize to crisp high-resolution PNG on canvas
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Use full natural dimensions (or crisp 2x scaling for SVGs)
      const scale = file.type === 'image/svg+xml' || file.name.endsWith('.svg') ? 2 : 1;
      const width = (img.naturalWidth || img.width || 800) * scale;
      const height = (img.naturalHeight || img.height || 600) * scale;

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(width, 1);
      canvas.height = Math.max(height, 1);
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        const fallbackReader = new FileReader();
        fallbackReader.readAsDataURL(file);
        fallbackReader.onload = () => {
          const res = fallbackReader.result as string;
          resolve({
            data: res.split(',')[1],
            mimeType: 'image/png',
          });
        };
        fallbackReader.onerror = () => resolve({ data: '', mimeType: 'image/png' });
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Export uncompressed lossless PNG Data URL
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      resolve({
        data: dataUrl.split(',')[1],
        mimeType: 'image/png',
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        resolve({
          data: result.split(',')[1],
          mimeType: normalizeVlmMimeType(file.type, file.name),
        });
      };
      reader.onerror = () => resolve({ data: '', mimeType: 'image/png' });
    };
  });
};

/**
 * Backward compatible helper returning raw Base64 string
 */
export const fileToBase64 = async (file: File): Promise<string> => {
  const processed = await processImageForVlm(file);
  return processed.data;
};
