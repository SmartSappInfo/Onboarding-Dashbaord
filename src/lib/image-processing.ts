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
  outputHeight?: number
): Promise<ProcessedImage & { file: File }> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  // Set canvas to the cropped size first
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  const croppedBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/webp', 0.95);
  });
  if (!croppedBlob) {
    throw new Error('Could not create cropped image blob.');
  }

  // Determine scaling
  let finalWidth = outputWidth;
  let finalHeight = outputHeight || Math.round((outputWidth / pixelCrop.width) * pixelCrop.height);

  const options = {
    maxSizeMB: 2,
    maxWidthOrHeight: Math.max(finalWidth, finalHeight),
    useWebWorker: true,
    initialQuality: quality / 100,
    fileType: 'image/webp',
    alwaysKeepResolution: false,
  };
  
  const originalFile = new File([croppedBlob], "temp.webp", {type: "image/webp"});
  const compressedBlob = await imageCompression(originalFile, options);

  const compressedDataUrl = URL.createObjectURL(compressedBlob);
  const finalImage = await createImage(compressedDataUrl);
  URL.revokeObjectURL(compressedDataUrl);
  
  const finalFile = new File([compressedBlob], `${fileName}.webp`, { type: 'image/webp' });

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
