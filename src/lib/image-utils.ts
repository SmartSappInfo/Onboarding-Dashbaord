'use client';
import imageCompression from 'browser-image-compression';
import { Area } from 'react-easy-crop';

export interface ProcessImageOptions {
  crop: Area;
  resize?: { width: number; };
  quality: number;
  format: 'jpeg' | 'png' | 'webp';
}

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
  file: File,
  options: ProcessImageOptions,
): Promise<ProcessedImage> {
  const imageSrc = URL.createObjectURL(file);
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  canvas.width = options.crop.width;
  canvas.height = options.crop.height;

  ctx.drawImage(
    image,
    options.crop.x,
    options.crop.y,
    options.crop.width,
    options.crop.height,
    0,
    0,
    options.crop.width,
    options.crop.height
  );

  URL.revokeObjectURL(imageSrc);

  const croppedBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, `image/${options.format}`, options.quality / 100);
  });
  if (!croppedBlob) {
    throw new Error('Could not create cropped image blob.');
  }

  const compressionOptions = {
    maxSizeMB: 2,
    maxWidthOrHeight: options.resize?.width,
    useWebWorker: true,
    initialQuality: options.quality / 100,
    fileType: `image/${options.format}`,
    alwaysKeepResolution: !options.resize?.width,
  };
  
  const compressedBlob = await imageCompression(new File([croppedBlob], file.name, {type: croppedBlob.type}), compressionOptions);
  const finalImage = await createImage(URL.createObjectURL(compressedBlob));

  return {
    blob: compressedBlob,
    width: finalImage.width,
    height: finalImage.height,
  };
}
