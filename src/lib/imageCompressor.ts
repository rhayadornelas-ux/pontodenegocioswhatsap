/**
 * Compresses a base64-encoded image down to a maximum width/height and quality
 * to save storage space (e.g. localStorage).
 */
export function compressImage(
  base64Str: string,
  maxWidth = 600,
  maxHeight = 600,
  quality = 0.7
): Promise<string> {
  // If it's not a base64 string or doesn't look like an image data URI, return as-is
  if (!base64Str || !base64Str.startsWith("data:image/")) {
    return Promise.resolve(base64Str);
  }

  // If the image is already tiny (e.g., under 15KB), don't process it to save time
  if (base64Str.length < 20000) {
    return Promise.resolve(base64Str);
  }

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Only downscale if it exceeds max bounds
      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(base64Str); // Fallback to original
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Convert to compressed jpeg image data url
      const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
      
      // If compression actually made it smaller, return it. Otherwise, return original.
      if (compressedDataUrl && compressedDataUrl.length < base64Str.length) {
        resolve(compressedDataUrl);
      } else {
        resolve(base64Str);
      }
    };

    img.onerror = () => {
      resolve(base64Str); // Return original if load failed
    };
  });
}

/**
 * Compresses multiple base64 image strings.
 */
export async function compressMultipleImages(
  images: string[],
  maxWidth = 600,
  maxHeight = 600,
  quality = 0.7
): Promise<string[]> {
  if (!images || images.length === 0) return [];
  return Promise.all(images.map((img) => compressImage(img, maxWidth, maxHeight, quality)));
}
