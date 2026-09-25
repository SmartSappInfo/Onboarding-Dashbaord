import { describe, it, expect } from 'vitest';
import {
  categorizeFileType,
  validateAndParseUrl,
  formatUnifiedArchitectEnvelope,
  extractTextFromFile,
  ARCHETYPE_PRESETS,
  type ArchitectUnifiedPayload,
} from '../survey-source-extractor';

describe('survey-source-extractor', () => {
  describe('categorizeFileType', () => {
    it('correctly categorizes PDF files', () => {
      const file = new File(['dummy'], 'quarterly_report.pdf', { type: 'application/pdf' });
      expect(categorizeFileType(file)).toBe('pdf');
    });

    it('correctly categorizes markdown files', () => {
      const file = new File(['# Title'], 'guide.md', { type: 'text/markdown' });
      expect(categorizeFileType(file)).toBe('markdown');
    });

    it('correctly categorizes CSV files', () => {
      const file = new File(['a,b,c'], 'metrics.csv', { type: 'text/csv' });
      expect(categorizeFileType(file)).toBe('csv');
    });

    it('correctly categorizes JSON files', () => {
      const file = new File(['{}'], 'schema.json', { type: 'application/json' });
      expect(categorizeFileType(file)).toBe('json');
    });

    it('correctly categorizes plain text files', () => {
      const file = new File(['hello world'], 'notes.txt', { type: 'text/plain' });
      expect(categorizeFileType(file)).toBe('text');
    });

    it('returns other for unknown extensions', () => {
      const file = new File(['binary'], 'image.png', { type: 'image/png' });
      expect(categorizeFileType(file)).toBe('other');
    });
  });

  describe('validateAndParseUrl', () => {
    it('parses valid HTTPS URLs', () => {
      const result = validateAndParseUrl('https://example.com/company/about');
      expect(result.isValid).toBe(true);
      expect(result.domain).toBe('example.com');
      expect(result.normalizedUrl).toBe('https://example.com/company/about');
    });

    it('adds https prefix to raw domains', () => {
      const result = validateAndParseUrl('docs.google.com/document/d/123');
      expect(result.isValid).toBe(true);
      expect(result.domain).toBe('docs.google.com');
      expect(result.normalizedUrl).toBe('https://docs.google.com/document/d/123');
    });

    it('strips www prefix for clean domain presentation', () => {
      const result = validateAndParseUrl('https://www.smartsapp.com/surveys');
      expect(result.isValid).toBe(true);
      expect(result.domain).toBe('smartsapp.com');
    });

    it('rejects empty or whitespace-only inputs', () => {
      const result = validateAndParseUrl('   ');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('rejects invalid single-word strings without domains', () => {
      const result = validateAndParseUrl('invalidurlwithoutdot');
      expect(result.isValid).toBe(false);
    });
  });

  describe('formatUnifiedArchitectEnvelope', () => {
    it('formats a complete multi-modal envelope with prompt, intent, URLs, and attached documents', () => {
      const payload: ArchitectUnifiedPayload = {
        prompt: 'Create a leadership assessment survey for engineering managers.',
        intent: {
          depth: 'standard',
          scoringMode: 'scored',
          tone: 'professional',
        },
        attachedUrls: [
          {
            id: 'url-1',
            url: 'https://company.org/leadership-principles',
            domain: 'company.org',
          },
        ],
        attachedFiles: [
          {
            id: 'file-1',
            name: 'engineering_rubric.txt',
            size: 2048,
            type: 'text',
            charCount: 150,
            content: 'Rubric Criterion 1: Architectural rigor.\nRubric Criterion 2: Mentorship and team velocity.',
            status: 'ready',
          },
        ],
      };

      const envelope = formatUnifiedArchitectEnvelope(payload);

      expect(envelope).toContain('# SURVEY ARCHITECT DIRECTIVES');
      expect(envelope).toContain('Create a leadership assessment survey for engineering managers.');
      expect(envelope).toContain('## ARCHITECTURAL INTENT:');
      expect(envelope).toContain('Target Length: Standard Assessment (6 to 10 questions)');
      expect(envelope).toContain('Scoring Configuration: Scored Assessment');
      expect(envelope).toContain('Desired Tone: professional');
      expect(envelope).toContain('## REFERENCE WEBSITES & LINKS:');
      expect(envelope).toContain('https://company.org/leadership-principles');
      expect(envelope).toContain('=== SOURCE MATERIAL DOCUMENTS ===');
      expect(envelope).toContain('engineering_rubric.txt');
      expect(envelope).toContain('Rubric Criterion 1: Architectural rigor.');
      expect(envelope).toContain('=== END SOURCE MATERIAL DOCUMENTS ===');
    });

    it('omits documents section if no files are ready', () => {
      const payload: ArchitectUnifiedPayload = {
        prompt: 'Quick CSAT survey',
        intent: {
          depth: 'compact',
          scoringMode: 'feedback',
        },
        attachedUrls: [],
        attachedFiles: [],
      };

      const envelope = formatUnifiedArchitectEnvelope(payload);
      expect(envelope).not.toContain('=== SOURCE MATERIAL DOCUMENTS ===');
      expect(envelope).toContain('Target Length: Compact & Focused (3 to 5 questions)');
    });
  });

  describe('extractTextFromFile guardrails', () => {
    it('throws error when file exceeds max size limit', async () => {
      const bigFile = new File([new Uint8Array(11 * 1024 * 1024)], 'giant_doc.txt', { type: 'text/plain' });
      await expect(extractTextFromFile(bigFile, { maxFileSizeMb: 10 })).rejects.toThrow(
        /exceeds the maximum allowed size/
      );
    });

    it('reads plain text files and measures character counts', async () => {
      const content = 'Line 1 of requirements\nLine 2 of requirements';
      const file = new File([content], 'spec.txt', { type: 'text/plain' });
      const result = await extractTextFromFile(file);

      expect(result.content).toBe(content);
      expect(result.charCount).toBe(content.length);
      expect(result.truncated).toBe(false);
    });

    it('truncates content when exceeding character cap', async () => {
      const longText = 'A'.repeat(500);
      const file = new File([longText], 'long.txt', { type: 'text/plain' });
      const result = await extractTextFromFile(file, { maxCharsPerFile: 100 });

      expect(result.truncated).toBe(true);
      expect(result.content).toContain('[Content truncated: exceeded character cap of 100 characters]');
      expect(result.content.startsWith('A'.repeat(100))).toBe(true);
    });
  });

  describe('ARCHETYPE_PRESETS', () => {
    it('contains at least 6 diverse archetype presets with prompts', () => {
      expect(ARCHETYPE_PRESETS.length).toBeGreaterThanOrEqual(6);
      ARCHETYPE_PRESETS.forEach((preset) => {
        expect(preset.id).toBeTruthy();
        expect(preset.title).toBeTruthy();
        expect(preset.promptSeed).toBeTruthy();
        expect(['compact', 'standard', 'in_depth']).toContain(preset.defaultDepth);
        expect(['auto', 'scored', 'feedback']).toContain(preset.defaultScoring);
      });
    });
  });
});
