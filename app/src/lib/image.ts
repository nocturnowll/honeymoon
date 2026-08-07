const MAX_IMAGE_PX = 1800;
const JPEG_QUALITY = 0.82;

/**
 * Resize and re-encode a selected image before it reaches IndexedDB.
 * Keeping this at the input boundary prevents every future photo surface from
 * accidentally persisting full-resolution camera files.
 */
export function processImage(
  file: Blob,
  maxPx = MAX_IMAGE_PX,
  quality = JPEG_QUALITY,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Images only — photograph a document rather than uploading a PDF'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('That file is not a readable image'));
      image.onload = () => {
        let { width, height } = image;
        const scale = Math.min(1, maxPx / Math.max(width, height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Could not encode that image'));
          return;
        }
        context.imageSmoothingQuality = 'high';
        context.drawImage(image, 0, 0, width, height);
        canvas.toBlob(
          blob => blob ? resolve(blob) : reject(new Error('Could not encode that image')),
          'image/jpeg',
          quality,
        );
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export const IMAGE_LIMITS = {
  maxPx: MAX_IMAGE_PX,
  quality: JPEG_QUALITY,
} as const;
