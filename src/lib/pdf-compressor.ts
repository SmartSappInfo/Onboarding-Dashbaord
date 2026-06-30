import { CompressionConfig, CompressionResult, WorkerMessageEvent } from './pdf-compressor.types';

/**
 * Compresses a PDF file client-side using a dynamically spawned Web Worker.
 * Handles JPG/PNG re-encoding via OffscreenCanvas and stream defragmenting.
 *
 * @param file The PDF File object selected by the user.
 * @param preset The compression intensity level.
 * @param onProgress Callback function to track compression percentage, current phase, and step detail.
 * @returns CompressionResult object with optimized bytes and size difference statistics.
 */
export async function compressPdf(
  file: File,
  preset: 'lossless' | 'balanced' | 'max',
  onProgress?: (progress: number, phase: string, details: string) => void
): Promise<CompressionResult> {
  return new Promise<CompressionResult>((resolve, reject) => {
    let quality = 0.8;
    let maxDimension = 1500;
    let stripMetadata = false;

    if (preset === 'max') {
      quality = 0.5;
      maxDimension = 900;
      stripMetadata = true;
    } else if (preset === 'balanced') {
      quality = 0.7;
      maxDimension = 1200;
      stripMetadata = true;
    } else {
      quality = 1.0;
      maxDimension = 4000;
      stripMetadata = false;
    }

    const config: CompressionConfig = {
      preset,
      quality,
      maxDimension,
      stripMetadata,
    };

    const reader = new FileReader();
    
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      const pdfBytes = new Uint8Array(arrayBuffer);

      try {
        // Instantiate the web worker dynamically
        const worker = new Worker(new URL('./pdf-compressor.worker.ts', import.meta.url));

        worker.onmessage = (event: MessageEvent<WorkerMessageEvent>) => {
          const message = event.data;

          if (message.type === 'progress') {
            if (onProgress) {
              onProgress(message.progress, message.phase, message.details || '');
            }
          } else if (message.type === 'success') {
            const savingsBytes = message.originalSize - message.compressedSize;
            const savingsPercentage = message.originalSize > 0 
              ? parseFloat(((savingsBytes / message.originalSize) * 100).toFixed(2)) 
              : 0;

            worker.terminate();
            resolve({
              pdfBytes: message.pdfBytes,
              originalSize: message.originalSize,
              compressedSize: message.compressedSize,
              savingsPercentage,
              imagesOptimized: message.imagesOptimized,
            });
          } else if (message.type === 'error') {
            worker.terminate();
            reject(new Error(message.error));
          }
        };

        worker.onerror = (err: ErrorEvent) => {
          worker.terminate();
          reject(new Error(err.message || 'Worker runtime error during compression'));
        };

        // Post request to worker
        worker.postMessage({ pdfBytes, config });

      } catch (err: unknown) {
        reject(err instanceof Error ? err : new Error('Failed to spawn PDF compressor worker'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to load local file bytes'));
    };

    reader.readAsArrayBuffer(file);
  });
}
