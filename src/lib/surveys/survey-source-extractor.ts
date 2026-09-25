/**
 * @fileoverview Survey AI Architect — Client-Side Document & Source Extraction Engine
 *
 * ARCHITECTURAL GUIDELINES (Rule 10 & Strict Zero-Any Invariant):
 * 1. Multi-Modal Format Ingestion:
 *    - PDF (.pdf via pdfjs-dist)
 *    - Microsoft Word (.docx via mammoth, .doc via binary stream extractor)
 *    - Microsoft Excel (.xlsx, .xls via SheetJS to structured Markdown tables)
 *    - PowerPoint (.pptx via jszip slide XML, .ppt via binary stream extractor)
 *    - Images (.png, .jpg, .jpeg, .webp via Approach 1: Native Multimodal Vision with canvas downscaling)
 *    - Text & Data (.txt, .md, .csv, .json)
 * 2. Boundary Guards & Memory Protection:
 *    - 10MB document limit (5MB image limit)
 *    - 20-page PDF cap, 30-slide PPT cap, 500-row spreadsheet cap
 *    - 25,000 character total envelope cap
 *    - Safe disposal of PDF documents and memory buffers
 * 3. Unified Envelope Formatting: Bundles user prompts, archetype guidelines, intent configurations,
 *    reference URLs, and source documents into a delimited Markdown envelope: === SOURCE MATERIAL ===.
 * 4. Strict Typing: Absolute zero `any` or `any[]` typing.
 */

export type SourceFileType =
  | 'pdf'
  | 'docx'
  | 'doc'
  | 'image'
  | 'xlsx'
  | 'xls'
  | 'pptx'
  | 'ppt'
  | 'text'
  | 'markdown'
  | 'csv'
  | 'json'
  | 'other';

export interface AttachedSourceFile {
  id: string;
  name: string;
  size: number;
  type: SourceFileType;
  charCount: number;
  pageCount?: number;
  content: string;
  thumbnailUrl?: string; // For images and previews
  dataUri?: string; // For Approach 1: Native Multimodal Vision
  dimensions?: { width: number; height: number };
  status: 'ready' | 'extracting' | 'error';
  errorMessage?: string;
}

export interface AttachedSourceUrl {
  id: string;
  url: string;
  title?: string;
  domain: string;
}

export type ArchitectSurveyDepth = 'compact' | 'standard' | 'in_depth';
export type ArchitectScoringMode = 'auto' | 'scored' | 'feedback';

export interface ArchitectIntentConfig {
  depth: ArchitectSurveyDepth; // compact: 3-5 Qs, standard: 6-10 Qs, in_depth: 11-15+ Qs
  scoringMode: ArchitectScoringMode; // auto: AI detects, scored: Pass/Fail quiz, feedback: un-scored survey
  tone?: 'professional' | 'conversational' | 'academic';
  effort?: string;
}

export interface ArchitectUnifiedPayload {
  prompt: string;
  attachedFiles: AttachedSourceFile[];
  attachedUrls: AttachedSourceUrl[];
  intent: ArchitectIntentConfig;
}

export interface ExtractionOptions {
  maxFileSizeMb?: number; // default: 10MB
  maxImageSizeMb?: number; // default: 5MB
  maxPdfPages?: number; // default: 20 pages
  maxCharsPerFile?: number; // default: 25,000 characters
  maxSpreadsheetRows?: number; // default: 500 rows
  maxPresentationSlides?: number; // default: 30 slides
}

export interface ArchetypePreset {
  id: string;
  badge: string;
  title: string;
  description: string;
  defaultDepth: ArchitectSurveyDepth;
  defaultScoring: ArchitectScoringMode;
  promptSeed: string;
}

export const ARCHETYPE_PRESETS: ArchetypePreset[] = [
  {
    id: 'csat_nps',
    badge: 'Customer Success',
    title: 'CSAT & NPS Survey',
    description: 'Measure net promoter score, agent helpfulness, and resolution speed.',
    defaultDepth: 'compact',
    defaultScoring: 'feedback',
    promptSeed:
      'Create an executive Customer Satisfaction (CSAT) and Net Promoter Score (NPS) survey. Include an NPS 0-10 rating question, a CSAT rating on recent support interactions, key satisfaction drivers (speed, quality, ease of use), and an open-ended suggestion box.',
  },
  {
    id: 'pulse_360',
    badge: 'People & Culture',
    title: 'Employee Pulse & 360',
    description: 'Evaluate team psychological safety, manager feedback, and burnout risk.',
    defaultDepth: 'standard',
    defaultScoring: 'feedback',
    promptSeed:
      'Create an anonymous quarterly employee pulse survey. Focus on psychological safety, leadership communication clarity, team collaboration, workload balance, and growth opportunities. Ensure tone is supportive and confidential.',
  },
  {
    id: 'scored_quiz',
    badge: 'Training & EdTech',
    title: 'Scored Assessment Quiz',
    description: 'Knowledge check with point-weighted answers, passing thresholds, and explanations.',
    defaultDepth: 'standard',
    defaultScoring: 'scored',
    promptSeed:
      'Create a graded knowledge check quiz on the provided training material. Include multiple-choice questions with 4 options each, assign point values to correct answers, and provide outcome tiers (e.g. Mastered 80%+, Needs Review 50-79%, Retake Required <50%).',
  },
  {
    id: 'pmf_survey',
    badge: 'Product Strategy',
    title: 'Product-Market Fit (PMF)',
    description: 'Superhuman methodology: measure user disappointment and primary value propositions.',
    defaultDepth: 'compact',
    defaultScoring: 'feedback',
    promptSeed:
      'Create a Sean Ellis Product-Market Fit survey. Include the signature question: "How would you feel if you could no longer use our product? (Very disappointed, Somewhat disappointed, Not disappointed)", what type of person would benefit most, and the primary benefit experienced.',
  },
  {
    id: 'event_feedback',
    badge: 'Events & Webinars',
    title: 'Event & Conference Pulse',
    description: 'Post-event attendee impressions, speaker ratings, and future topic interest.',
    defaultDepth: 'compact',
    defaultScoring: 'feedback',
    promptSeed:
      'Create a post-event attendee feedback survey. Measure overall event satisfaction, key takeaways, speaker quality, logistical ease, and topics attendees want covered in future sessions.',
  },
  {
    id: 'lead_intake',
    badge: 'Sales & Growth',
    title: 'Lead Qualification & Intake',
    description: 'Qualify prospects, identify project budget, timelines, and business challenges.',
    defaultDepth: 'standard',
    defaultScoring: 'auto',
    promptSeed:
      'Create an engaging lead qualification and intake survey for prospective enterprise clients. Capture industry sector, company size, primary pain points, target rollout timeline, and estimated annual budget range.',
  },
];

/**
 * Determine file type category based on extension and mime type.
 */
export function categorizeFileType(file: File): SourceFileType {
  const name = file.name.toLowerCase();
  const mime = file.type.toLowerCase();

  if (name.endsWith('.pdf') || mime === 'application/pdf') return 'pdf';
  if (name.endsWith('.docx') || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (name.endsWith('.doc') || mime === 'application/msword') return 'doc';
  if (
    name.endsWith('.png') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.webp') ||
    mime.startsWith('image/')
  ) {
    return 'image';
  }
  if (name.endsWith('.xlsx') || mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'xlsx';
  if (name.endsWith('.xls') || mime === 'application/vnd.ms-excel') return 'xls';
  if (name.endsWith('.pptx') || mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') return 'pptx';
  if (name.endsWith('.ppt') || mime === 'application/vnd.ms-powerpoint') return 'ppt';
  if (name.endsWith('.md') || name.endsWith('.markdown')) return 'markdown';
  if (name.endsWith('.csv') || mime === 'text/csv') return 'csv';
  if (name.endsWith('.json') || mime === 'application/json') return 'json';
  if (name.endsWith('.txt') || name.endsWith('.tsv') || mime.startsWith('text/')) return 'text';

  return 'other';
}

interface PdfTextItem {
  str: string;
}

/**
 * Formats a 2D row array into a readable GitHub Flavored Markdown table.
 */
export function formatRowsAsMarkdownTable(sheetName: string, rows: unknown[][]): string {
  if (!rows || rows.length === 0) return `### Sheet: ${sheetName}\n*(Empty sheet)*`;

  const headerRow = rows[0] || [];
  const headerCols = headerRow.map((col, idx) => (col !== null && col !== undefined && String(col).trim() ? String(col).trim() : `Col ${idx + 1}`));
  const headerLine = `| ${headerCols.join(' | ')} |`;
  const separatorLine = `| ${headerCols.map(() => '---').join(' | ')} |`;

  const bodyLines = rows.slice(1).map((row) => {
    const cells = headerCols.map((_, idx) => {
      const val = row[idx];
      if (val === null || val === undefined) return '';
      return String(val).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
    });
    return `| ${cells.join(' | ')} |`;
  });

  return `### Sheet: ${sheetName}\n${headerLine}\n${separatorLine}\n${bodyLines.join('\n')}`;
}

/**
 * Extracts printable ASCII/UTF-16 text chunks safely from legacy binary DOC and PPT files.
 */
export function extractTextFromLegacyBinary(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const textChunks: string[] = [];
  let currentWord = '';

  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    // Printable ASCII characters (32 to 126) plus newline and tab
    if ((byte >= 32 && byte <= 126) || byte === 10 || byte === 13 || byte === 9) {
      currentWord += String.fromCharCode(byte);
    } else {
      if (currentWord.trim().length >= 4) {
        textChunks.push(currentWord.trim());
      }
      currentWord = '';
    }
  }

  if (currentWord.trim().length >= 4) {
    textChunks.push(currentWord.trim());
  }

  // Deduplicate and filter noise words
  const cleanChunks = textChunks.filter((chunk) => {
    // Filter out common binary header signatures
    return !/^[0-9a-f]{8,}$/i.test(chunk) && !chunk.startsWith('CompObj') && !chunk.startsWith('WordDocument');
  });

  return cleanChunks.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Optimizes and encodes an image to a base64 Data URI with canvas downscaling (Approach 1).
 * Clamps max width/height to 1536px to prevent massive payloads while preserving text sharpness.
 */
export async function optimizeAndEncodeImage(
  file: File,
  options?: { maxDimension?: number; quality?: number }
): Promise<{ dataUri: string; width: number; height: number }> {
  const maxDim = options?.maxDimension ?? 1536;
  const quality = options?.quality ?? 0.85;

  // Browser environment canvas downscaling
  if (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function'
  ) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        try {
          let { width, height } = img;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            // Fallback if 2d context fails
            const reader = new FileReader();
            reader.onload = () => resolve({ dataUri: reader.result as string, width: img.width, height: img.height });
            reader.onerror = () => reject(new Error('Failed to read image file'));
            reader.readAsDataURL(file);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const dataUri = canvas.toDataURL('image/jpeg', quality);
          resolve({ dataUri, width, height });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          reject(new Error(`Failed to downscale and encode image "${file.name}": ${msg}`));
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error(`Failed to load image "${file.name}" for optimization.`));
      };

      img.src = objectUrl;
    });
  }

  // Node or test environment fallback
  if (typeof file.arrayBuffer === 'function') {
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const mime = file.type || 'image/jpeg';
    return {
      dataUri: `data:${mime};base64,${base64}`,
      width: 1024,
      height: 768,
    };
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        dataUri: (reader.result as string) || '',
        width: 1024,
        height: 768,
      });
    };
    reader.onerror = () => reject(new Error(`Failed to read file ${file.name}`));
    reader.readAsDataURL(file);
  });
}

/**
 * Client-side multi-format document and image extractor.
 * Reads text and multimedia directly in the browser via FileReader, pdfjs-dist, mammoth, SheetJS, or JSZip.
 */
export async function extractTextFromFile(
  file: File,
  options?: ExtractionOptions
): Promise<{
  content: string;
  pageCount?: number;
  charCount: number;
  thumbnailUrl?: string;
  dataUri?: string;
  dimensions?: { width: number; height: number };
  truncated: boolean;
}> {
  const category = categorizeFileType(file);
  const maxBytes =
    category === 'image'
      ? (options?.maxImageSizeMb ?? 5) * 1024 * 1024
      : (options?.maxFileSizeMb ?? 10) * 1024 * 1024;
  const maxPages = options?.maxPdfPages ?? 20;
  const maxChars = options?.maxCharsPerFile ?? 25000;
  const maxRows = options?.maxSpreadsheetRows ?? 500;
  const maxSlides = options?.maxPresentationSlides ?? 30;

  if (file.size > maxBytes) {
    const limitMb = category === 'image' ? (options?.maxImageSizeMb ?? 5) : (options?.maxFileSizeMb ?? 10);
    throw new Error(`File "${file.name}" exceeds the maximum allowed size of ${limitMb} MB.`);
  }

  let rawContent = '';
  let pageCount: number | undefined;
  let thumbnailUrl: string | undefined;
  let dataUri: string | undefined;
  let dimensions: { width: number; height: number } | undefined;

  if (category === 'other') {
    throw new Error(
      `Unsupported file type for "${file.name}". Please attach PDF, DOCX, DOC, PNG, JPG, PPT, PPTX, XLS, XLSX, TXT, CSV, or JSON documents.`
    );
  }

  // 1. PDF EXTRACTION
  if (category === 'pdf') {
    if (typeof window === 'undefined') {
      throw new Error('PDF extraction is only supported in browser environments.');
    }

    interface DestroyablePdf {
      numPages: number;
      getPage: (pageNumber: number) => Promise<{
        getTextContent: () => Promise<{ items: unknown[] }>;
        cleanup?: () => void;
      }>;
      destroy?: () => Promise<void>;
    }

    interface DestroyableLoadingTask {
      promise: Promise<DestroyablePdf>;
      destroy?: () => Promise<void>;
    }

    let loadingTask: DestroyableLoadingTask | null = null;
    let pdf: DestroyablePdf | null = null;

    try {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs`;

      const arrayBuffer = await file.arrayBuffer();
      loadingTask = pdfjs.getDocument({ data: arrayBuffer }) as unknown as DestroyableLoadingTask;
      pdf = await loadingTask.promise;

      pageCount = pdf.numPages;
      const pagesToExtract = Math.min(pdf.numPages, maxPages);
      const textParts: string[] = [];

      for (let i = 1; i <= pagesToExtract; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: unknown) => {
            const textItem = item as PdfTextItem;
            return typeof textItem.str === 'string' ? textItem.str : '';
          })
          .join(' ');

        if (typeof page.cleanup === 'function') {
          page.cleanup();
        }

        if (pageText.trim()) {
          textParts.push(`--- Page ${i} ---\n${pageText.trim()}`);
        }
      }

      if (pdf.numPages > maxPages) {
        textParts.push(`\n[Note: Document has ${pdf.numPages} pages; extraction capped at first ${maxPages} pages]`);
      }

      rawContent = textParts.join('\n\n');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to extract text from PDF "${file.name}": ${msg}`);
    } finally {
      if (pdf && typeof pdf.destroy === 'function') {
        try {
          await pdf.destroy();
        } catch {
          // ignore cleanup failures
        }
      }
      if (loadingTask && typeof loadingTask.destroy === 'function') {
        try {
          await loadingTask.destroy();
        } catch {
          // ignore cleanup failures
        }
      }
    }
  }

  // 2. MICROSOFT WORD (.docx)
  else if (category === 'docx') {
    try {
      const mammothModule = await import('mammoth');
      const mammoth = mammothModule.default || mammothModule;
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      rawContent = result.value.trim();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to extract text from DOCX "${file.name}": ${msg}`);
    }
  }

  // 3. LEGACY WORD (.doc)
  else if (category === 'doc') {
    try {
      const arrayBuffer = await file.arrayBuffer();
      rawContent = extractTextFromLegacyBinary(arrayBuffer);
      if (!rawContent) {
        rawContent = `[Legacy Word Document: ${file.name} — Please save as .docx for enhanced formatting and structure]`;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to read legacy DOC "${file.name}": ${msg}`);
    }
  }

  // 4. MICROSOFT EXCEL (.xlsx, .xls)
  else if (category === 'xlsx' || category === 'xls') {
    try {
      const XLSX = await import('xlsx');
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetParts: string[] = [];

      // Extract up to 5 sheets
      const targetSheets = workbook.SheetNames.slice(0, 5);
      pageCount = targetSheets.length;

      for (const sheetName of targetSheets) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;
        const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
        if (!rows || rows.length === 0) continue;

        const cappedRows = rows.slice(0, maxRows);
        const mdTable = formatRowsAsMarkdownTable(sheetName, cappedRows);
        sheetParts.push(mdTable);

        if (rows.length > maxRows) {
          sheetParts.push(`*(Note: Sheet "${sheetName}" has ${rows.length} rows; capped at first ${maxRows} rows)*`);
        }
      }

      rawContent = sheetParts.join('\n\n');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to extract spreadsheet data from "${file.name}": ${msg}`);
    }
  }

  // 5. POWERPOINT (.pptx)
  else if (category === 'pptx') {
    try {
      const JSZipModule = await import('jszip');
      const JSZip = JSZipModule.default || JSZipModule;
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);

      const slideFiles = Object.keys(zip.files)
        .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
        .sort((a, b) => {
          const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
          const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
          return numA - numB;
        });

      pageCount = slideFiles.length;
      const slideParts: string[] = [];
      const slidesToProcess = Math.min(slideFiles.length, maxSlides);

      for (let i = 0; i < slidesToProcess; i++) {
        const slideFile = zip.files[slideFiles[i]];
        const xmlText = await slideFile.async('text');
        // Extract text content inside <a:t>...</a:t>
        const textMatches = Array.from(xmlText.matchAll(/<a:t(?:\s+[^>]*)?>([^<]*)<\/a:t>/g), (m) => m[1]);
        const slideText = textMatches
          .join(' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
          .replace(/\s+/g, ' ')
          .trim();
        if (slideText) {
          slideParts.push(`--- Slide ${i + 1} ---\n${slideText}`);
        }
      }

      if (slideFiles.length > maxSlides) {
        slideParts.push(`\n[Note: Presentation has ${slideFiles.length} slides; extraction capped at first ${maxSlides} slides]`);
      }

      rawContent = slideParts.join('\n\n');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to extract presentation slides from "${file.name}": ${msg}`);
    }
  }

  // 6. LEGACY POWERPOINT (.ppt)
  else if (category === 'ppt') {
    try {
      const arrayBuffer = await file.arrayBuffer();
      rawContent = extractTextFromLegacyBinary(arrayBuffer);
      if (!rawContent) {
        rawContent = `[Legacy PowerPoint Presentation: ${file.name} — Please save as .pptx for enhanced slide extraction]`;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to read legacy PPT "${file.name}": ${msg}`);
    }
  }

  // 7. IMAGES (Approach 1: Native Multimodal Vision)
  else if (category === 'image') {
    try {
      const optimized = await optimizeAndEncodeImage(file, {
        maxDimension: 1536,
        quality: 0.85,
      });

      thumbnailUrl = optimized.dataUri;
      dataUri = optimized.dataUri;
      dimensions = { width: optimized.width, height: optimized.height };
      rawContent = `[Attached Image: ${file.name} (${optimized.width}x${optimized.height}) — Multimodal vision analysis active]`;

      return {
        content: rawContent,
        charCount: 0,
        thumbnailUrl,
        dataUri,
        dimensions,
        truncated: false,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to process image "${file.name}": ${msg}`);
    }
  }

  // 8. PLAIN TEXT / MARKDOWN / CSV / JSON
  else {
    rawContent = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string) || '');
      reader.onerror = () => reject(new Error(`Failed to read text file "${file.name}".`));
      reader.readAsText(file);
    });
  }

  // Apply maximum character limit
  const isTruncated = rawContent.length > maxChars;
  const finalContent = isTruncated
    ? rawContent.slice(0, maxChars) + '\n\n... [Content truncated due to character limit]'
    : rawContent;

  return {
    content: finalContent.trim(),
    pageCount,
    charCount: finalContent.trim().length,
    thumbnailUrl,
    dataUri,
    dimensions,
    truncated: isTruncated,
  };
}

/**
 * Validates and extracts domain from user-provided URLs.
 */
export function validateAndParseUrl(rawUrl: string): {
  isValid: boolean;
  normalizedUrl?: string;
  domain?: string;
  error?: string;
} {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { isValid: false, error: 'URL cannot be empty.' };
  }

  let testUrl = trimmed;
  if (!/^https?:\/\//i.test(testUrl)) {
    testUrl = `https://${testUrl}`;
  }

  try {
    const parsed = new URL(testUrl);
    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      return { isValid: false, error: 'Please enter a valid web domain (e.g. acme.com).' };
    }

    const cleanDomain = parsed.hostname.replace(/^www\./i, '');
    return {
      isValid: true,
      normalizedUrl: parsed.toString(),
      domain: cleanDomain,
    };
  } catch {
    return { isValid: false, error: 'Invalid URL format.' };
  }
}

/**
 * Bundles prompt, archetype, intent, attached files, and links into a structured Markdown envelope.
 */
export function formatUnifiedArchitectEnvelope(payload: ArchitectUnifiedPayload): string {
  const { prompt, attachedFiles, attachedUrls, intent } = payload;
  const parts: string[] = [];

  // 1. Primary Instructions & Prompt
  parts.push('### USER ARCHITECTURAL INSTRUCTIONS:');
  parts.push(prompt.trim() || '*(No custom prompt provided; infer objectives from attached source documents)*');
  parts.push('');

  // 2. Intent & Scope Configuration
  parts.push('### ARCHITECTURAL INTENT CONFIGURATION:');
  const depthMap: Record<ArchitectSurveyDepth, string> = {
    compact: 'Compact / Micro (3–5 Questions focused on high completion rate)',
    standard: 'Standard Assessment (6–10 Questions with balanced depth and sections)',
    in_depth: 'In-Depth / Comprehensive (11–15+ Questions with structured multi-page flows)',
  };
  const scoringMap: Record<ArchitectScoringMode, string> = {
    auto: 'Auto-Detect (Enable scoring only if content represents an assessment, quiz, or qualification)',
    scored: 'Enforce Scored Assessment (Points, thresholds, and outcome tier result pages required)',
    feedback: 'Unscored Feedback (Focus purely on qualitative and rating feedback without point weights)',
  };

  parts.push(`- **Target Depth**: ${depthMap[intent.depth]}`);
  parts.push(`- **Scoring Strategy**: ${scoringMap[intent.scoringMode]}`);
  if (intent.tone) {
    parts.push(`- **Target Tone**: ${intent.tone.toUpperCase()}`);
  }
  parts.push('');

  // 3. Attached Images (Multimodal Vision Notice)
  const imageFiles = attachedFiles.filter((f) => f.type === 'image');
  if (imageFiles.length > 0) {
    parts.push('### ATTACHED IMAGES (MULTIMODAL VISION):');
    imageFiles.forEach((img, idx) => {
      parts.push(`- **Image ${idx + 1}**: "${img.name}" (${img.dimensions?.width || 0}x${img.dimensions?.height || 0}) — Ingested via native vision for layout, diagram, and question recognition.`);
    });
    parts.push('');
  }

  // 4. Attached Reference URLs
  if (attachedUrls.length > 0) {
    parts.push('### REFERENCE WEBSITES & EXTERNAL CONTEXT:');
    attachedUrls.forEach((u, idx) => {
      parts.push(`- **Reference ${idx + 1}** [${u.domain}]: ${u.url}`);
    });
    parts.push('');
  }

  // 5. Extracted Source Documents Envelope
  const docFiles = attachedFiles.filter((f) => f.type !== 'image' && f.content.trim().length > 0);
  if (docFiles.length > 0) {
    parts.push('=== SOURCE MATERIAL ===');
    docFiles.forEach((doc, idx) => {
      // Escape any occurrence of envelope delimiters inside untrusted document content
      const sanitizedDocContent = doc.content
        .replace(/=== END SOURCE MATERIAL ===/gi, '===[END SOURCE MATERIAL]===')
        .replace(/=== SOURCE MATERIAL ===/gi, '===[SOURCE MATERIAL]===');

      parts.push(`--- BEGIN DOCUMENT ${idx + 1}: "${doc.name}" (${doc.type.toUpperCase()}, ${doc.charCount} chars) ---`);
      parts.push(sanitizedDocContent);
      parts.push(`--- END DOCUMENT ${idx + 1}: "${doc.name}" ---\n`);
    });
    parts.push('=== END SOURCE MATERIAL ===');
  }

  return parts.join('\n');
}
