import { describe, it, expect, vi } from 'vitest';
import {
  validateFileType,
  validateFileSize,
  splitFileUrls,
  formatFileSize,
  normalizeCustomExtensions,
} from '../survey-file-utils';
import { syncSurveyUploadedFilesToMedia } from '../survey-actions';
import { extractFileNameFromStorageUrl } from '../survey-response-utils';

// Mock Firebase Admin
vi.mock('../firebase-admin', () => {
  const addMock = vi.fn().mockResolvedValue({ id: 'mock_media_doc_id' });
  const getMock = vi.fn().mockResolvedValue({ empty: true });
  const limitMock = vi.fn().mockReturnValue({ get: getMock });
  const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
  const collectionMock = vi.fn().mockReturnValue({
    where: whereMock,
    add: addMock,
  });

  return {
    adminDb: {
      collection: collectionMock,
    },
  };
});

describe('Survey File Upload Validation Utilities', () => {
  describe('normalizeCustomExtensions', () => {
    it('normalizes comma and space separated extensions with leading dots', () => {
      const result = normalizeCustomExtensions('xlsx, .csv, PDF, docx');
      expect(result).toEqual(['.xlsx', '.csv', '.pdf', '.docx']);
    });

    it('handles empty or undefined inputs gracefully', () => {
      expect(normalizeCustomExtensions('')).toEqual([]);
      expect(normalizeCustomExtensions(undefined)).toEqual([]);
    });
  });

  describe('validateFileType', () => {
    it('allows all formats when allowedTypes contains "all" or is empty', () => {
      const dummyFile = new File(['dummy content'], 'document.xyz', { type: 'application/unknown' });
      expect(validateFileType(dummyFile, ['all']).valid).toBe(true);
      expect(validateFileType(dummyFile, []).valid).toBe(true);
      expect(validateFileType(dummyFile, undefined).valid).toBe(true);
    });

    it('validates spreadsheets correctly (.xlsx, .xls, .csv)', () => {
      const excelFile = new File(['data'], 'students.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const csvFile = new File(['data'], 'staff.csv', { type: 'text/csv' });
      const pdfFile = new File(['data'], 'report.pdf', { type: 'application/pdf' });
      const txtFile = new File(['some plain text'], 'notes.txt', { type: 'text/plain' });
      const pythonFile = new File(['print("hello")'], 'script.py', { type: 'text/plain' });

      expect(validateFileType(excelFile, ['spreadsheets']).valid).toBe(true);
      expect(validateFileType(csvFile, ['spreadsheets']).valid).toBe(true);
      expect(validateFileType(pdfFile, ['spreadsheets']).valid).toBe(false);
      expect(validateFileType(txtFile, ['spreadsheets']).valid).toBe(false);
      expect(validateFileType(pythonFile, ['spreadsheets']).valid).toBe(false);
      expect(validateFileType(pdfFile, ['spreadsheets']).error).toContain('Allowed formats');
    });

    it('validates documents & PDFs correctly', () => {
      const pdfFile = new File(['data'], 'handbook.pdf', { type: 'application/pdf' });
      const docxFile = new File(['data'], 'notes.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const imgFile = new File(['data'], 'photo.png', { type: 'image/png' });

      expect(validateFileType(pdfFile, ['documents']).valid).toBe(true);
      expect(validateFileType(docxFile, ['documents']).valid).toBe(true);
      expect(validateFileType(imgFile, ['documents']).valid).toBe(false);
    });

    it('validates custom extensions correctly', () => {
      const jsonFile = new File(['{}'], 'data.json', { type: 'application/json' });
      const xmlFile = new File(['<xml/>'], 'data.xml', { type: 'application/xml' });

      expect(validateFileType(jsonFile, ['custom'], '.json, .xml').valid).toBe(true);
      expect(validateFileType(xmlFile, ['custom'], '.json, .xml').valid).toBe(true);

      const exeFile = new File(['bin'], 'malicious.exe', { type: 'application/x-msdownload' });
      expect(validateFileType(exeFile, ['custom'], '.json, .xml').valid).toBe(false);
    });
  });

  describe('validateFileSize', () => {
    it('accepts files within maximum size limit', () => {
      const smallFile = new File(['hello world'], 'hello.txt', { type: 'text/plain' });
      expect(validateFileSize(smallFile, 25).valid).toBe(true);
    });

    it('rejects files exceeding maximum size limit', () => {
      // Mock large file size
      const bigFile = new File(['big'], 'large.xlsx', { type: 'application/vnd.ms-excel' });
      Object.defineProperty(bigFile, 'size', { value: 30 * 1024 * 1024 }); // 30 MB

      const result = validateFileSize(bigFile, 25);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds the 25MB limit');
    });
  });

  describe('splitFileUrls', () => {
    it('splits comma-separated URLs and trims whitespace', () => {
      const raw = 'https://storage.googleapis.com/f1.xlsx, https://storage.googleapis.com/f2.pdf';
      expect(splitFileUrls(raw)).toEqual([
        'https://storage.googleapis.com/f1.xlsx',
        'https://storage.googleapis.com/f2.pdf',
      ]);
    });

    it('handles single URL strings', () => {
      const raw = 'https://storage.googleapis.com/single.pdf';
      expect(splitFileUrls(raw)).toEqual(['https://storage.googleapis.com/single.pdf']);
    });

    it('handles array of URLs', () => {
      const raw = ['https://storage.googleapis.com/f1.xlsx', 'https://storage.googleapis.com/f2.pdf'];
      expect(splitFileUrls(raw)).toEqual([
        'https://storage.googleapis.com/f1.xlsx',
        'https://storage.googleapis.com/f2.pdf',
      ]);
    });

    it('filters empty or non-http strings', () => {
      expect(splitFileUrls('')).toEqual([]);
      expect(splitFileUrls(null)).toEqual([]);
      expect(splitFileUrls(undefined)).toEqual([]);
      expect(splitFileUrls('not-a-url,   ')).toEqual([]);
    });
  });

  describe('formatFileSize', () => {
    it('formats bytes into KB, MB, and GB properly', () => {
      expect(formatFileSize(0)).toBe('0 B');
      expect(formatFileSize(1024)).toBe('1.0 KB');
      expect(formatFileSize(1024 * 1024 * 2.5)).toBe('2.5 MB');
    });
  });

  describe('extractFileNameFromStorageUrl', () => {
    it('strips leading 10-14 digit timestamp prefixes', () => {
      const url = 'https://firebasestorage.googleapis.com/v0/b/app/o/survey-uploads%2F1740001234567-student_roster.xlsx?alt=media';
      expect(extractFileNameFromStorageUrl(url)).toBe('student_roster.xlsx');
    });

    it('preserves natural hyphens in filenames without timestamps', () => {
      const url = 'https://firebasestorage.googleapis.com/v0/b/app/o/survey-uploads%2Fq1-financial-report.pdf?alt=media';
      expect(extractFileNameFromStorageUrl(url)).toBe('q1-financial-report.pdf');
    });

    it('handles filenames with multiple hyphens and no timestamp', () => {
      const url = 'https://firebasestorage.googleapis.com/v0/b/app/o/survey-uploads%2Fschool-annual-budget-plan.docx?alt=media';
      expect(extractFileNameFromStorageUrl(url)).toBe('school-annual-budget-plan.docx');
    });
  });

  describe('syncSurveyUploadedFilesToMedia', () => {
    it('synchronizes multiple comma-separated URLs to media collection', async () => {
      const answers = [
        {
          questionId: 'upload_block_1',
          value:
            'https://firebasestorage.googleapis.com/v0/b/app/o/survey-uploads%2F123-data1.xlsx?alt=media, https://firebasestorage.googleapis.com/v0/b/app/o/survey-uploads%2F123-data2.pdf?alt=media',
        },
      ];

      const registered = await syncSurveyUploadedFilesToMedia(
        'ws_test_123',
        answers,
        'Staff Onboarding Survey',
        'entity_school_99'
      );

      expect(registered.length).toBe(2);
      expect(registered[0]).toContain('data1.xlsx');
      expect(registered[1]).toContain('data2.pdf');
    });
  });
});
