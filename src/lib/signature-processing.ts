'use client';

/**
 * @fileOverview Advanced image processing for signature and photo isolation.
 * Handles grayscale conversion, adaptive thresholding, background removal, 
 * stroke dilation (thickness), and Gaussian-style smoothing.
 */

export interface ProcessingResult {
  dataUrl: string;
  width: number;
  height: number;
}

const TARGET_WIDTH = 1000;

/**
 * Creates an image object from a URL.
 */
const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (error) => reject(error);
    img.src = url;
  });

/**
 * Processes a raw image to isolate ink and remove the paper background.
 * Supports manual cropping and rotation from the refinement step.
 */
export async function processSignatureImage(
  sourceUrl: string, 
  threshold: number = 150,
  thickness: number = 0,
  smoothing: number = 0,
  cropArea?: { x: number, y: number, width: number, height: number },
  rotation: number = 0,
  skipAutoCrop: boolean = false
): Promise<ProcessingResult> {
  const img = await createImage(sourceUrl);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  
  if (!ctx) throw new Error('Failed to initialize canvas context.');

  // 1. SPATIAL TRANSFORMATION (Rotation & Cropping)
  // If cropArea is provided, we use the user's manual framing
  const sourceW = cropArea ? cropArea.width : img.width;
  const sourceH = cropArea ? cropArea.height : img.height;
  
  canvas.width = sourceW;
  canvas.height = sourceH;

  // Apply rotation and draw the cropped segment
  if (rotation !== 0) {
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-canvas.width / 2, -canvas.height / 2);
  }

  if (cropArea) {
      ctx.drawImage(img, cropArea.x, cropArea.y, cropArea.width, cropArea.height, 0, 0, canvas.width, canvas.height);
  } else {
      ctx.drawImage(img, 0, 0);
  }

  // 2. SMOOTHING PASS (Digital Convolution)
  if (smoothing > 0) {
      ctx.filter = `blur(${smoothing * 0.5}px)`;
      ctx.drawImage(canvas, 0, 0);
      ctx.filter = 'none';
  }

  // 3. DILATION PASS (Thickness)
  if (thickness > 0) {
      const t = thickness * 0.5;
      ctx.globalAlpha = 0.8;
      for (let dy = -t; dy <= t; dy += 0.5) {
          for (let dx = -t; dx <= t; dx += 0.5) {
              if (dx !== 0 || dy !== 0) ctx.drawImage(canvas, dx, dy);
          }
      }
      ctx.globalAlpha = 1.0;
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // 4. THRESHOLDING & TRANSPARENCY PASS (Ink Isolation)
  // Hard normalization to pure black (#000000)
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

    if (brightness < threshold) {
      data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; // Pure Black
      data[i + 3] = 255; // Opaque
    } else {
      data[i + 3] = 0; // Transparent Background
    }
  }

  ctx.putImageData(imageData, 0, 0);

  // 5. AUTO-CROP (TIGHTEN)
  // Skip if we are doing a live preview to maintain coordinate stability
  if (skipAutoCrop) {
      return { 
          dataUrl: canvas.toDataURL('image/png'), 
          width: canvas.width, 
          height: canvas.height 
      };
  }

  let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
  let foundInk = false;

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (data[(y * canvas.width + x) * 4 + 3] > 0) {
        foundInk = true;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }

  // If no ink found, return original cropped area
  if (!foundInk) {
      return { 
          dataUrl: canvas.toDataURL('image/png'), 
          width: canvas.width, 
          height: canvas.height 
      };
  }

  const padding = 10;
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(canvas.width, maxX + padding);
  maxY = Math.min(canvas.height, maxY + padding);

  const finalW = maxX - minX;
  const finalH = maxY - minY;

  // 6. OUTPUT NORMALIZATION
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = TARGET_WIDTH;
  outputCanvas.height = Math.round((finalH / finalW) * TARGET_WIDTH);
  
  const oCtx = outputCanvas.getContext('2d');
  if (!oCtx) throw new Error('Failed to initialize output context.');

  oCtx.drawImage(canvas, minX, minY, finalW, finalH, 0, 0, outputCanvas.width, outputCanvas.height);

  return {
    dataUrl: outputCanvas.toDataURL('image/png'),
    width: outputCanvas.width,
    height: outputCanvas.height
  };
}

/**
 * Enhances a standard photo (brightness/contrast).
 */
export async function processPhotoImage(
    sourceUrl: string,
    brightness: number = 0, // -100 to 100
    contrast: number = 0    // -100 to 100
): Promise<ProcessingResult> {
    const img = await createImage(sourceUrl);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) throw new Error('Failed to initialize canvas context.');

    // Normalize to standard width for form consistency
    canvas.width = TARGET_WIDTH;
    canvas.height = Math.round((img.height / img.width) * TARGET_WIDTH);

    // Apply Filter String
    ctx.filter = `brightness(${100 + brightness}%) contrast(${100 + contrast}%)`;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    return {
        dataUrl: canvas.toDataURL('image/jpeg', 0.9),
        width: canvas.width,
        height: canvas.height
    };
}
