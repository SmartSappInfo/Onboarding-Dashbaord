import { PDFDocument, PDFName, PDFRawStream, PDFRef, PDFObject } from 'pdf-lib';
import { WorkerRequestPayload, WorkerMessageEvent } from './pdf-compressor.types';

interface WorkerScope {
  onmessage: ((ev: MessageEvent<WorkerRequestPayload>) => void) | null;
  postMessage(message: WorkerMessageEvent): void;
}

interface PublicPDFContext {
  indirectObjects: Map<PDFRef, PDFObject>;
}

const ctx = self as unknown as WorkerScope;

ctx.onmessage = async (event: MessageEvent<WorkerRequestPayload>) => {
  const { pdfBytes, config } = event.data;
  
  try {
    ctx.postMessage({
      type: 'progress',
      phase: 'reading',
      progress: 10,
      details: 'Parsing PDF document structure...'
    } as WorkerMessageEvent);

    const pdfDoc = await PDFDocument.load(pdfBytes);
    const context = pdfDoc.context as unknown as PublicPDFContext;
    const indirectObjects = context.indirectObjects;
    const refsToCompress: PDFRef[] = [];
    
    // 1. Scan for image XObjects
    ctx.postMessage({
      type: 'progress',
      phase: 'extracting',
      progress: 30,
      details: 'Scanning for embedded images...'
    } as WorkerMessageEvent);

    for (const [ref, object] of indirectObjects.entries()) {
      if (object instanceof PDFRawStream) {
        const dict = object.dict;
        const subtype = dict.get(PDFName.of('Subtype'));
        if (subtype === PDFName.of('Image')) {
          refsToCompress.push(ref);
        }
      }
    }

    let imagesOptimized = 0;
    const totalImages = refsToCompress.length;

    // 2. Process and compress each image
    if (totalImages > 0 && config.preset !== 'lossless') {
      for (let i = 0; i < totalImages; i++) {
        const ref = refsToCompress[i];
        const oldImageStream = indirectObjects.get(ref);
        
        if (oldImageStream instanceof PDFRawStream) {
          const dict = oldImageStream.dict;
          const filter = dict.get(PDFName.of('Filter'));
          const smask = dict.get(PDFName.of('SMask'));
          
          // Check transparency soft-mask
          const hasSMask = smask !== undefined;
          
          let isJpeg = false;
          if (filter === PDFName.of('DCTDecode')) {
            isJpeg = true;
          }
          
          ctx.postMessage({
            type: 'progress',
            phase: 'compressing',
            progress: Math.min(30 + Math.round((i / totalImages) * 50), 80),
            details: `Compressing image ${i + 1} of ${totalImages}...`
          } as WorkerMessageEvent);

          // Attempt to compress all image streams that can be decoded by browser APIs
          // Skip transparency if configuring maximum compression to avoid layout issues
          if (!hasSMask || config.preset !== 'max') {
            try {
              const rawBytes = oldImageStream.contents;
              const width = dict.get(PDFName.of('Width'))?.toString() || '0';
              const height = dict.get(PDFName.of('Height'))?.toString() || '0';
              const wVal = parseInt(width, 10);
              const hVal = parseInt(height, 10);

              if (wVal > 0 && hVal > 0) {
                const compressedBytes = await compressImageBytes(
                  rawBytes,
                  wVal,
                  hVal,
                  config.quality,
                  config.maxDimension
                );

                if (compressedBytes.length < rawBytes.length) {
                  // Embed the new compressed image into the PDF context
                  const newImage = await pdfDoc.embedJpg(compressedBytes);
                  const newImageStream = pdfDoc.context.lookup(newImage.ref);
                  
                  if (newImageStream instanceof PDFRawStream) {
                    // Copy alpha soft-mask if it was originally transparent
                    if (hasSMask) {
                      newImageStream.dict.set(PDFName.of('SMask'), smask);
                    }
                    // Swap indirect object reference
                    indirectObjects.set(ref, newImageStream);
                    imagesOptimized++;
                  }
                }
              }
            } catch (imageErr) {
              console.warn(`Failed to compress image object at ref: ${ref.toString()}`, imageErr);
              // Graceful fallback: keep original image
            }
          }
        }
      }
    }

    // 3. Metadata stripping
    if (config.stripMetadata) {
      ctx.postMessage({
        type: 'progress',
        phase: 'saving',
        progress: 85,
        details: 'Cleaning document metadata...'
      } as WorkerMessageEvent);
      
      pdfDoc.setTitle('');
      pdfDoc.setAuthor('');
      pdfDoc.setSubject('');
      pdfDoc.setCreator('');
      pdfDoc.setProducer('');
      pdfDoc.setCreationDate(new Date());
      pdfDoc.setModificationDate(new Date());
    }

    // 4. Serialize and save the compressed PDF
    ctx.postMessage({
      type: 'progress',
      phase: 'saving',
      progress: 90,
      details: 'Writing compressed PDF file streams...'
    } as WorkerMessageEvent);

    // Save with object streams to group and compress cross-references
    const compressedPdfBytes = await pdfDoc.save({
      useObjectStreams: true
    });

    ctx.postMessage({
      type: 'success',
      pdfBytes: compressedPdfBytes,
      imagesOptimized,
      originalSize: pdfBytes.length,
      compressedSize: compressedPdfBytes.length
    } as WorkerMessageEvent);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown PDF compression failure';
    ctx.postMessage({
      type: 'error',
      error: message
    } as WorkerMessageEvent);
  }
};

// OffscreenCanvas Image Compression Helper
async function compressImageBytes(
  bytes: Uint8Array,
  width: number,
  height: number,
  quality: number,
  maxDimension: number
): Promise<Uint8Array> {
  const blob = new Blob([bytes as unknown as BlobPart]);
  const imageBitmap = await createImageBitmap(blob);
  
  let newWidth = width;
  let newHeight = height;
  
  if (width > maxDimension || height > maxDimension) {
    if (width > height) {
      newWidth = maxDimension;
      newHeight = Math.round((height * maxDimension) / width);
    } else {
      newHeight = maxDimension;
      newWidth = Math.round((width * maxDimension) / height);
    }
  }
  
  const canvas = new OffscreenCanvas(newWidth, newHeight);
  const ctx2d = canvas.getContext('2d');
  
  if (!ctx2d) {
    imageBitmap.close();
    throw new Error('Failed to get 2D context for OffscreenCanvas');
  }
  
  ctx2d.drawImage(imageBitmap, 0, 0, newWidth, newHeight);
  imageBitmap.close();
  
  const compressedBlob = await canvas.convertToBlob({
    type: 'image/jpeg',
    quality: quality
  });
  
  return new Uint8Array(await compressedBlob.arrayBuffer());
}
