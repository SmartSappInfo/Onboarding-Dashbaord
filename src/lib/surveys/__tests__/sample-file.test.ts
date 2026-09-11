import { describe, it, expect } from 'vitest';
import {
  isSafeSampleFileUrl,
  resolveSampleFile,
  SAMPLE_FILE_DEFAULT_BUTTON_TEXT,
} from '../sample-file';

const STORAGE_URL =
  'https://firebasestorage.googleapis.com/v0/b/app.appspot.com/o/media%2Fdocument%2F1740001234567-Staff_Roster.xlsx?alt=media&token=abc';

describe('isSafeSampleFileUrl', () => {
  describe('accepts', () => {
    it('Firebase Storage download URLs', () => {
      expect(isSafeSampleFileUrl(STORAGE_URL)).toBe(true);
    });

    it('the newer firebasestorage.app bucket host', () => {
      expect(
        isSafeSampleFileUrl('https://studio-123.firebasestorage.app/o/media%2Ft.xlsx?alt=media'),
      ).toBe(true);
    });

    it('Google Cloud Storage URLs', () => {
      expect(isSafeSampleFileUrl('https://storage.googleapis.com/bucket/media/t.xlsx')).toBe(true);
    });

    it('same-origin relative paths, so a future proxy route keeps working', () => {
      expect(isSafeSampleFileUrl('/api/survey-templates/staff.xlsx')).toBe(true);
    });
  });

  describe('rejects', () => {
    // The survey document is world-readable once published, so whatever URL lands in
    // `sampleFileUrl` is handed to every respondent. A compromised author account must
    // not be able to turn that into a malware or phishing distribution channel.
    it('arbitrary third-party hosts', () => {
      expect(isSafeSampleFileUrl('https://evil.test/payload.exe')).toBe(false);
      expect(isSafeSampleFileUrl('http://evil.test/payload.exe')).toBe(false);
    });

    it('a host that merely embeds an allowed host as a substring', () => {
      expect(isSafeSampleFileUrl('https://firebasestorage.googleapis.com.evil.test/x')).toBe(false);
    });

    it('dangerous schemes', () => {
      expect(isSafeSampleFileUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeSampleFileUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    });

    it('protocol-relative URLs', () => {
      expect(isSafeSampleFileUrl('//evil.test/payload.exe')).toBe(false);
    });

    it('empty input', () => {
      expect(isSafeSampleFileUrl('')).toBe(false);
      expect(isSafeSampleFileUrl(null)).toBe(false);
      expect(isSafeSampleFileUrl(undefined)).toBe(false);
    });
  });
});

describe('resolveSampleFile', () => {
  describe('returns null when there is nothing to show', () => {
    it('when the sample is not enabled', () => {
      expect(resolveSampleFile({ sampleFileEnabled: false, sampleFileUrl: STORAGE_URL })).toBeNull();
    });

    it('when enabled but no file has been chosen yet', () => {
      expect(resolveSampleFile({ sampleFileEnabled: true })).toBeNull();
      expect(resolveSampleFile({ sampleFileEnabled: true, sampleFileUrl: '   ' })).toBeNull();
    });

    it('when the URL fails the host allowlist', () => {
      expect(
        resolveSampleFile({ sampleFileEnabled: true, sampleFileUrl: 'https://evil.test/x.xlsx' }),
      ).toBeNull();
    });

    it('for an empty question object', () => {
      expect(resolveSampleFile({})).toBeNull();
    });
  });

  describe('file name', () => {
    it('derives a clean name from the storage URL, stripping the upload timestamp', () => {
      const result = resolveSampleFile({ sampleFileEnabled: true, sampleFileUrl: STORAGE_URL });
      expect(result?.fileName).toBe('Staff_Roster.xlsx');
    });

    it('prefers an explicitly stored file name', () => {
      const result = resolveSampleFile({
        sampleFileEnabled: true,
        sampleFileUrl: STORAGE_URL,
        sampleFileName: 'Staff Roster Template.xlsx',
      });
      expect(result?.fileName).toBe('Staff Roster Template.xlsx');
    });
  });

  describe('copy', () => {
    it('falls back to the file name when no title is set', () => {
      const result = resolveSampleFile({ sampleFileEnabled: true, sampleFileUrl: STORAGE_URL });
      expect(result?.title).toBe('Staff_Roster.xlsx');
    });

    it('uses the default button label when none is set', () => {
      const result = resolveSampleFile({ sampleFileEnabled: true, sampleFileUrl: STORAGE_URL });
      expect(result?.buttonText).toBe(SAMPLE_FILE_DEFAULT_BUTTON_TEXT);
    });

    it('returns an empty description when none is set', () => {
      const result = resolveSampleFile({ sampleFileEnabled: true, sampleFileUrl: STORAGE_URL });
      expect(result?.description).toBe('');
    });

    // Author copy fields are plain-text inputs, but authors paste from Word and Docs.
    // Nothing that reaches the page may contain markup.
    it('strips markup pasted into the copy fields', () => {
      const result = resolveSampleFile({
        sampleFileEnabled: true,
        sampleFileUrl: STORAGE_URL,
        sampleFileTitle: '<span style="color: rgb(1,2,3)">Staff template</span>',
        sampleFileDescription: '<p>Fill this in &amp; upload it below.</p>',
        sampleFileButtonText: '<b>Get the sheet</b>',
      });
      expect(result?.title).toBe('Staff template');
      expect(result?.description).toBe('Fill this in & upload it below.');
      expect(result?.buttonText).toBe('Get the sheet');
    });

    it('falls back when copy is markup only', () => {
      const result = resolveSampleFile({
        sampleFileEnabled: true,
        sampleFileUrl: STORAGE_URL,
        sampleFileTitle: '<span></span>',
        sampleFileButtonText: '<i></i>',
      });
      expect(result?.title).toBe('Staff_Roster.xlsx');
      expect(result?.buttonText).toBe(SAMPLE_FILE_DEFAULT_BUTTON_TEXT);
    });
  });

  describe('extension', () => {
    it('detects a spreadsheet extension in lower case', () => {
      const result = resolveSampleFile({ sampleFileEnabled: true, sampleFileUrl: STORAGE_URL });
      expect(result?.extension).toBe('.xlsx');
    });

    it('detects an uppercase extension', () => {
      const result = resolveSampleFile({
        sampleFileEnabled: true,
        sampleFileUrl: STORAGE_URL,
        sampleFileName: 'Roster.PDF',
      });
      expect(result?.extension).toBe('.pdf');
    });

    it('returns an empty extension when the name has none', () => {
      const result = resolveSampleFile({
        sampleFileEnabled: true,
        sampleFileUrl: STORAGE_URL,
        sampleFileName: 'roster',
      });
      expect(result?.extension).toBe('');
    });
  });

  describe('resilience', () => {
    it('never throws on an odd but allowlisted URL', () => {
      expect(() =>
        resolveSampleFile({
          sampleFileEnabled: true,
          sampleFileUrl: 'https://storage.googleapis.com',
        }),
      ).not.toThrow();
    });

    it('always yields a non-empty file name and title', () => {
      const result = resolveSampleFile({
        sampleFileEnabled: true,
        sampleFileUrl: 'https://storage.googleapis.com',
      });
      expect(result?.fileName).toBeTruthy();
      expect(result?.title).toBeTruthy();
    });
  });
});
