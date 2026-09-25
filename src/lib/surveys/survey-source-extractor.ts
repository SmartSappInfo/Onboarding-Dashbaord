/**
 * @fileoverview Survey AI Architect — Client-Side Document & Source Extraction Engine
 *
 * ARCHITECTURAL GUIDELINES (Rule 10 & Strict Zero-Any Invariant):
 * 1. Safe Extraction: Extracts clean text from PDF (pdfjs-dist), Markdown, Plain Text, CSV, and JSON.
 * 2. Strict Boundary Guards: Enforces max file size (10MB), max PDF pages (20 pages), and character caps (25,000 chars)
 *    to prevent memory exhaustion, browser tab freezes, and prompt payload overflow.
 * 3. Unified Envelope Formatting: Bundles user prompts, archetype guidelines, intent configurations,
 *    reference URLs, and source documents into a delimited Markdown envelope: === SOURCE MATERIAL ===.
 * 4. Strict Typing: Absolute zero `any` or `any[]` typing.
 */

export type SourceFileType = 'pdf' | 'text' | 'markdown' | 'csv' | 'json' | 'other';

export interface AttachedSourceFile {
  id: string;
  name: string;
  size: number;
  type: SourceFileType;
  charCount: number;
  pageCount?: number;
  content: string;
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
}

export interface ArchitectUnifiedPayload {
  prompt: string;
  attachedFiles: AttachedSourceFile[];
  attachedUrls: AttachedSourceUrl[];
  intent: ArchitectIntentConfig;
}

export interface ExtractionOptions {
  maxFileSizeMb?: number; // default: 10MB
  maxPdfPages?: number; // default: 20 pages
  maxCharsPerFile?: number; // default: 25,000 characters
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
 * Client-side document extractor.
 * Reads text directly in the browser via FileReader or pdfjs-dist.
 */
export async function extractTextFromFile(
  file: File,
  options?: ExtractionOptions
): Promise<{ content: string; pageCount?: number; charCount: number; truncated: boolean }> {
  const maxBytes = (options?.maxFileSizeMb ?? 10) * 1024 * 1024;
  const maxPages = options?.maxPdfPages ?? 20;
  const maxChars = options?.maxCharsPerFile ?? 25000;

  if (file.size > maxBytes) {
    throw new Error(`File "${file.name}" exceeds the maximum allowed size of ${options?.maxFileSizeMb ?? 10} MB.`);
  }

  const category = categorizeFileType(file);
  let rawContent = '';
  let pageCount: number | undefined;

  if (category === 'pdf') {
    if (typeof window === 'undefined') {
      throw new Error('PDF extraction is only supported in browser environments.');
    }

    try {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs`;

      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

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
    }
  } else {
    // Plain text, Markdown, CSV, JSON
    rawContent = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error(`Failed to read content from "${file.name}".`));
        }
      };
      reader.onerror = () => {
        reject(new Error(`Error reading file "${file.name}".`));
      };
      reader.readAsText(file);
    });
  }

  // Enforce character truncation guardrail
  let truncated = false;
  let finalContent = rawContent.trim();
  if (finalContent.length > maxChars) {
    finalContent =
      finalContent.slice(0, maxChars) +
      `\n\n[Content truncated: exceeded character cap of ${maxChars.toLocaleString()} characters]`;
    truncated = true;
  }

  return {
    content: finalContent,
    pageCount,
    charCount: finalContent.length,
    truncated,
  };
}

/**
 * Validates and parses a raw URL string, extracting domain for badge presentation.
 */
export function validateAndParseUrl(
  rawUrl: string
): { isValid: boolean; normalizedUrl: string; domain: string; error?: string } {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { isValid: false, normalizedUrl: '', domain: '', error: 'URL cannot be empty.' };
  }

  let formatted = trimmed;
  if (!/^https?:\/\//i.test(formatted)) {
    formatted = `https://${formatted}`;
  }

  try {
    const parsed = new URL(formatted);
    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      return { isValid: false, normalizedUrl: '', domain: '', error: 'Please enter a valid domain address.' };
    }
    return {
      isValid: true,
      normalizedUrl: parsed.toString(),
      domain: parsed.hostname.replace(/^www\./, ''),
    };
  } catch {
    return { isValid: false, normalizedUrl: '', domain: '', error: 'Invalid URL format.' };
  }
}

/**
 * Formats user prompt, architectural intent, attached URLs, and extracted document text
 * into a structured, delimited Markdown envelope compatible with backend chunked flows.
 */
export function formatUnifiedArchitectEnvelope(payload: ArchitectUnifiedPayload): string {
  const sections: string[] = [];

  // 1. Core Directives
  sections.push('# SURVEY ARCHITECT DIRECTIVES');
  sections.push(payload.prompt.trim() || 'Create an intelligent survey based on the provided source material.');

  // 2. Architectural Intent
  const depthLabels: Record<ArchitectSurveyDepth, string> = {
    compact: 'Compact & Focused (3 to 5 questions)',
    standard: 'Standard Assessment (6 to 10 questions)',
    in_depth: 'Comprehensive / In-Depth (11 to 15+ questions)',
  };

  const scoringLabels: Record<ArchitectScoringMode, string> = {
    auto: 'Auto-Detect (Assess if quiz material is present, otherwise create feedback flow)',
    scored: 'Scored Assessment (Assign points, correct answers, and Pass/Fail result outcomes)',
    feedback: 'Feedback / Perception Only (No point scoring, focus on qualitative and Likert scales)',
  };

  sections.push('\n## ARCHITECTURAL INTENT:');
  sections.push(`- Target Length: ${depthLabels[payload.intent.depth]}`);
  sections.push(`- Scoring Configuration: ${scoringLabels[payload.intent.scoringMode]}`);
  if (payload.intent.tone) {
    sections.push(`- Desired Tone: ${payload.intent.tone}`);
  }

  // 3. Reference URLs
  if (payload.attachedUrls.length > 0) {
    sections.push('\n## REFERENCE WEBSITES & LINKS:');
    payload.attachedUrls.forEach((u, idx) => {
      sections.push(`${idx + 1}. ${u.url} (${u.domain})`);
    });
  }

  // 4. Source Documents Envelope
  const readyFiles = payload.attachedFiles.filter((f) => f.status === 'ready' && f.content.trim().length > 0);
  if (readyFiles.length > 0) {
    sections.push('\n=== SOURCE MATERIAL DOCUMENTS ===');
    readyFiles.forEach((file, index) => {
      const sizeKb = (file.size / 1024).toFixed(1);
      const meta = [
        `File ${index + 1}: ${file.name}`,
        `Size: ${sizeKb} KB`,
        `Type: ${file.type.toUpperCase()}`,
        file.pageCount ? `Pages: ${file.pageCount}` : null,
      ]
        .filter(Boolean)
        .join(' | ');

      sections.push(`\n[SOURCE DOCUMENT: ${meta}]`);
      sections.push(file.content.trim());
      sections.push(`[END SOURCE DOCUMENT: ${file.name}]\n`);
    });
    sections.push('=== END SOURCE MATERIAL DOCUMENTS ===');
  }

  return sections.join('\n');
}
