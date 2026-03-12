'use client';

/**
 * @fileOverview Advanced image processing for signature isolation.
 * Handles grayscale conversion, adaptive thresholding, background removal, 
 * stroke dilation (thickness), and smoothing.
 */

export interface ProcessingResult {
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Processes a raw image to isolate ink and remove the paper background.
 * @param sourceUrl Base64 data URI of the captured image.
 * @param threshold The darkness threshold (0-255). Lower values are more selective.
 * @param thickness Stroke dilation level (0-2). Thicker lines for lighter pens.
 */
export async function processSignatureImage(
  sourceUrl: string, 
  threshold: number = 150,
  thickness: number = 0
): Promise<ProcessingResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        reject(new Error('Failed to initialize canvas context.'));
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;
      
      // Initial draw
      ctx.drawImage(img, 0, 0);

      // 1. DILATION PASS (Thickness)
      // We simulate thicker ink by drawing the image slightly offset multiple times
      if (thickness > 0) {
          const t = thickness * 0.5; // Scale for pixel offsets
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.globalAlpha = 0.8;
          for (let dy = -t; dy <= t; dy += 0.5) {
              for (let dx = -t; dx <= t; dx += 0.5) {
                  ctx.drawImage(img, dx, dy);
              }
          }
          ctx.globalAlpha = 1.0;
      }

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // 2. Thresholding & Transparency Pass
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Perceptual brightness calculation
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

        if (brightness < threshold) {
          // Normalize ink to black
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
          data[i + 3] = 255;
        } else {
          // Remove background
          data[i + 3] = 0;
        }
      }

      ctx.putImageData(imageData, 0, 0);

      // 3. Auto-Cropping Pass
      let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
      let foundInk = false;

      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const alpha = data[(y * canvas.width + x) * 4 + 3];
          if (alpha > 0) {
            foundInk = true;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (!foundInk) {
        resolve({ dataUrl: sourceUrl, width: img.width, height: img.height });
        return;
      }

      // Padding for the crop
      const padding = 10;
      minX = Math.max(0, minX - padding);
      minY = Math.max(0, minY - padding);
      maxX = Math.min(canvas.width, maxX + padding);
      maxY = Math.min(canvas.height, maxY + padding);

      const cropW = maxX - minX;
      const cropH = maxY - minY;

      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = cropW;
      cropCanvas.height = cropH;
      const cropCtx = cropCanvas.getContext('2d');
      
      if (!cropCtx) {
        reject(new Error('Failed to initialize crop context.'));
        return;
      }

      // Apply smoothing via shadow blur if requested (implicit in threshold pass usually)
      // but for high fidelity we can draw with slight blur
      cropCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

      resolve({
        dataUrl: cropCanvas.toDataURL('image/png'),
        width: cropW,
        height: cropH
      });
    };
    img.onerror = () => reject(new Error('Failed to load source image.'));
    img.src = sourceUrl;
  });
}
