'use client';

import imageCompression from 'browser-image-compression';
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
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  // The crop box dimensions
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  // The origin of the crop box in the natural unrotated coordinate system
  const cropX = pixelCrop.x;
  const cropY = pixelCrop.y;

  const rotateRads = (rotation * Math.PI) / 180;
  const centerX = image.naturalWidth / 2;
  const centerY = image.naturalHeight / 2;

  ctx.save();

  // Move the crop origin to the canvas origin (0,0)
  ctx.translate(-cropX, -cropY);
  
  // Move the origin to the center of the original position to allow for rotating around the center
  ctx.translate(centerX, centerY);
  ctx.rotate(rotateRads);
  
  // Move center back to top left (0,0)
  ctx.translate(-centerX, -centerY);
  
  // Draw the image
  ctx.drawImage(
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

  ctx.restore();

  const mimeType = format === 'jpeg' ? 'image/jpeg' : format === 'png' ? 'image/png' : 'image/webp';
  const croppedBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, mimeType, quality / 100);
  });
  
  if (!croppedBlob) {
    throw new Error('Could not create cropped image blob.');
  }

  // Determine scaling
  let finalWidth = outputWidth;
  let finalHeight = outputHeight || Math.round((outputWidth / pixelCrop.width) * pixelCrop.height);

  const options = {
    maxSizeMB: 50, // Let the main uploader handle size limits, we just want to resize
    maxWidthOrHeight: Math.max(finalWidth, finalHeight),
    useWebWorker: true,
    initialQuality: quality / 100,
    fileType: mimeType,
    alwaysKeepResolution: true, // We want the exact dimensions requested
  };
  
  const originalFile = new File([croppedBlob], `temp.${format}`, {type: mimeType});
  const compressedBlob = await imageCompression(originalFile, options);

  const compressedDataUrl = URL.createObjectURL(compressedBlob);
  const finalImage = await createImage(compressedDataUrl);
  URL.revokeObjectURL(compressedDataUrl);
  
  const finalFile = new File([compressedBlob], `${fileName}.${format}`, { type: mimeType });

  return {
    blob: compressedBlob,
    file: finalFile,
    width: finalImage.width,
    height: finalImage.height,
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
