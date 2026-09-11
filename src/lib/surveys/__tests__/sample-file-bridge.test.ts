import { describe, it, expect } from 'vitest';
import { bridgeSampleFileFields } from '../sample-file-bridge';

const URL_A = 'https://firebasestorage.googleapis.com/v0/b/app/o/media%2Fdoc%2FRoster.xlsx?alt=media';
const URL_B = 'https://firebasestorage.googleapis.com/v0/b/app/o/media%2Fdoc%2FOther.pdf?alt=media';

describe('bridgeSampleFileFields', () => {
  describe('file-upload -> document', () => {
    it('moves the sample file onto the document block', () => {
      const result = bridgeSampleFileFields('file-upload', 'document', {
        sampleFileEnabled: true,
        sampleFileUrl: URL_A,
        sampleFileName: 'Roster.xlsx',
        sampleFileButtonText: 'Get the sheet',
      });

      expect(result.url).toBe(URL_A);
      expect(result.fileName).toBe('Roster.xlsx');
      expect(result.buttonText).toBe('Get the sheet');
    });

    it('clears the sample fields so they cannot linger as orphans', () => {
      const result = bridgeSampleFileFields('file-upload', 'document', {
        sampleFileEnabled: true,
        sampleFileUrl: URL_A,
        sampleFileName: 'Roster.xlsx',
        sampleFileTitle: 'Staff template',
        sampleFileDescription: 'Fill this in.',
        sampleFileButtonText: 'Get the sheet',
      });

      expect(result.sampleFileEnabled).toBeUndefined();
      expect(result.sampleFileUrl).toBeUndefined();
      expect(result.sampleFileName).toBeUndefined();
      expect(result.sampleFileTitle).toBeUndefined();
      expect(result.sampleFileDescription).toBeUndefined();
      expect(result.sampleFileButtonText).toBeUndefined();
    });

    // Never clobber data the author can still see. The question's own description is the
    // more prominent field, so it wins over the sample's note.
    it('does not overwrite a value the target block already has', () => {
      const result = bridgeSampleFileFields('file-upload', 'document', {
        sampleFileEnabled: true,
        sampleFileUrl: URL_A,
        sampleFileDescription: 'Sample note',
        url: URL_B,
        description: 'Existing description',
      });

      expect(result.url).toBeUndefined();
      expect(result.description).toBeUndefined();
    });
  });

  describe('document -> file-upload', () => {
    it('attaches the document as the question sample and switches it on', () => {
      const result = bridgeSampleFileFields('document', 'file-upload', {
        url: URL_A,
        fileName: 'Roster.xlsx',
        buttonText: 'Download Template',
      });

      expect(result.sampleFileEnabled).toBe(true);
      expect(result.sampleFileUrl).toBe(URL_A);
      expect(result.sampleFileName).toBe('Roster.xlsx');
      expect(result.sampleFileButtonText).toBe('Download Template');
    });

    // The document's `title` becomes the question's title via the caller's base spread.
    // Copying it into the sample heading as well would print it twice on the card.
    it('leaves the sample title unset so the card falls back to the file name', () => {
      const result = bridgeSampleFileFields('document', 'file-upload', {
        url: URL_A,
        title: 'School Data Template',
      });

      expect(result.sampleFileTitle).toBeUndefined();
    });

    it('does not switch the sample on when the document has no file', () => {
      const result = bridgeSampleFileFields('document', 'file-upload', { title: 'Empty block' });
      expect(result.sampleFileEnabled).toBeUndefined();
      expect(result.sampleFileUrl).toBeUndefined();
    });
  });

  describe('every other conversion', () => {
    it('returns no changes, so unrelated type switches behave exactly as before', () => {
      expect(bridgeSampleFileFields('text', 'long-text', { title: 'Q' })).toEqual({});
      expect(bridgeSampleFileFields('image', 'video', { url: URL_A })).toEqual({});
      expect(bridgeSampleFileFields('file-upload', 'text', { sampleFileUrl: URL_A })).toEqual({});
    });

    it('returns no changes when the type is unchanged', () => {
      expect(bridgeSampleFileFields('file-upload', 'file-upload', { sampleFileUrl: URL_A })).toEqual(
        {},
      );
    });
  });
});
