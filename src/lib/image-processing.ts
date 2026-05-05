'use client';

import { Area } from 'react-easy-crop';

export interface ProcessedImage {
  blob: Blob;
  width: number;
  height: number;
}

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

/**
 * Main function to crop, resize, and compress an image.
 */
export async function processImage(
  imageSrc: string,
  pixelCrop: Area,
  outputWidth: number,
  quality: number = 80,
  fileName: string,
  outputHeight?: number,
  format: 'jpeg' | 'png' | 'webp' = 'webp',
  rotation: number = 0
): Promise<ProcessedImage & { file: File }> {
  const image = await createImage(imageSrc);
  const cropCanvas = document.createElement('canvas');
  const cropCtx = cropCanvas.getContext('2d');

  if (!cropCtx) {
    throw new Error('Could not get canvas context');
  }

  // Fallback to prevent NaN or 0 width errors
  const safeCropWidth = Math.max(1, pixelCrop.width);
  const safeCropHeight = Math.max(1, pixelCrop.height);

  // The crop box dimensions
  cropCanvas.width = safeCropWidth;
  cropCanvas.height = safeCropHeight;

  // The origin of the crop box in the natural unrotated coordinate system
  const cropX = pixelCrop.x;
  const cropY = pixelCrop.y;

  const rotateRads = (rotation * Math.PI) / 180;
  const centerX = image.naturalWidth / 2;
  const centerY = image.naturalHeight / 2;

  cropCtx.save();
  // Move the crop origin to the canvas origin (0,0)
  cropCtx.translate(-cropX, -cropY);
  // Move the origin to the center of the original position to allow for rotating around the center
  cropCtx.translate(centerX, centerY);
  cropCtx.rotate(rotateRads);
  // Move center back to top left (0,0)
  cropCtx.translate(-centerX, -centerY);
  // Draw the image
  cropCtx.drawImage(
    image,
    0,
    0,
    image.naturalWidth,
    image.naturalHeight,
    0,
    0,
    image.naturalWidth,
    image.naturalHeight
  );
  cropCtx.restore();

  // Create final canvas to apply Output Dimensions (resizing/stretching)
  const finalWidth = Math.max(1, outputWidth || safeCropWidth);
  const finalHeight = Math.max(1, outputHeight || Math.round((finalWidth / safeCropWidth) * safeCropHeight));

  const finalCanvas = document.createElement('canvas');
  const finalCtx = finalCanvas.getContext('2d');
  if (!finalCtx) throw new Error('Could not get final canvas context');

  finalCanvas.width = finalWidth;
  finalCanvas.height = finalHeight;

  // Draw the cropped image into the final canvas, stretching it to the exact Output Dimensions
  finalCtx.drawImage(cropCanvas, 0, 0, safeCropWidth, safeCropHeight, 0, 0, finalWidth, finalHeight);

  const mimeType = format === 'jpeg' ? 'image/jpeg' : format === 'png' ? 'image/png' : 'image/webp';
  
  // Use native canvas toBlob for high-performance, synchronous compression
  const finalBlob = await new Promise<Blob | null>((resolve) => {
    finalCanvas.toBlob(resolve, mimeType, Math.max(0.1, quality / 100));
  });
  
  if (!finalBlob) {
    throw new Error('Could not create final image blob.');
  }

  const finalFile = new File([finalBlob], `${fileName}.${format}`, { type: mimeType });

  return {
    blob: finalBlob,
    file: finalFile,
    width: finalWidth,
    height: finalHeight,
  };
}

export async function getImageDimensions(file: File): Promise<{ width: number; height: number; dataUrl: string }> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            // Note: we don't revoke here because the URL is passed back as dataUrl for preview/editing
            // The consumer of this function must call URL.revokeObjectURL(dataUrl) when done
            resolve({ width: image.width, height: image.height, dataUrl: url });
        };
        image.onerror = (e) => {
            URL.revokeObjectURL(url);
            reject(e);
        };
        image.src = url;
    });
}
