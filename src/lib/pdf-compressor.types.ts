export type CompressionPreset = 'lossless' | 'balanced' | 'max';

export interface CompressionConfig {
  preset: CompressionPreset;
  quality: number; // Image compression quality, from 0.0 to 1.0
  maxDimension: number; // Maximum width or height of resized images
  stripMetadata: boolean;
}

export interface WorkerProgressEvent {
  type: 'progress';
  phase: 'reading' | 'extracting' | 'compressing' | 'saving';
  progress: number; // 0 to 100
  details?: string;
}

export interface WorkerSuccessEvent {
  type: 'success';
  pdfBytes: Uint8Array;
  imagesOptimized: number;
  originalSize: number;
  compressedSize: number;
}

export interface WorkerErrorEvent {
  type: 'error';
  error: string;
}

export type WorkerMessageEvent = WorkerProgressEvent | WorkerSuccessEvent | WorkerErrorEvent;

export interface WorkerRequestPayload {
  pdfBytes: Uint8Array;
  config: CompressionConfig;
}

export interface CompressionResult {
  pdfBytes: Uint8Array;
  originalSize: number;
  compressedSize: number;
  savingsPercentage: number;
  imagesOptimized: number;
}
