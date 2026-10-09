import { describe, it, expect } from 'vitest';
import {
  detectNoteColumn,
  isValidNoteText,
  formatNoteContent,
  buildEntityNotePayload,
} from '../note-import-helpers';

describe('note-import-helpers', () => {
  describe('detectNoteColumn', () => {
    it('detects common note headers across case and punctuation variations', () => {
      expect(detectNoteColumn(['Name', 'Email', 'Phone', 'Personal Notes'])).toBe('Personal Notes');
      expect(detectNoteColumn(['Company', 'Email', 'NOTES'])).toBe('NOTES');
      expect(detectNoteColumn(['School', 'remarks'])).toBe('remarks');
      expect(detectNoteColumn(['Contact', 'Comments / Feedback'])).toBe('Comments / Feedback');
      expect(detectNoteColumn(['First Name', 'Last Name', 'Call Notes'])).toBe('Call Notes');
    });

    it('returns null when no note-like column is present', () => {
      expect(detectNoteColumn(['Name', 'Email', 'Phone', 'Address', 'Status'])).toBeNull();
      expect(detectNoteColumn([])).toBeNull();
    });
  });

  describe('isValidNoteText', () => {
    it('returns true for non-empty text', () => {
      expect(isValidNoteText('Lead has been verified and ready for phone call')).toBe(true);
      expect(isValidNoteText('Call back tomorrow')).toBe(true);
      expect(isValidNoteText(12345)).toBe(true);
    });

    it('returns false for empty or whitespace-only inputs', () => {
      expect(isValidNoteText('')).toBe(false);
      expect(isValidNoteText('   ')).toBe(false);
      expect(isValidNoteText('\n\t')).toBe(false);
      expect(isValidNoteText(null)).toBe(false);
      expect(isValidNoteText(undefined)).toBe(false);
    });
  });

  describe('formatNoteContent', () => {
    it('trims whitespace cleanly', () => {
      expect(formatNoteContent('  Needs follow-up on pricing.  ')).toBe('Needs follow-up on pricing.');
    });

    it('prepends prefix when provided', () => {
      expect(formatNoteContent('Ready for onboarding', 'Imported Note')).toBe('[Imported Note] Ready for onboarding');
      expect(formatNoteContent('Ready for onboarding', '[Imported Note]')).toBe('[Imported Note] Ready for onboarding');
    });

    it('caps extremely large note text safely to prevent resource exhaustion', () => {
      const hugeText = 'A'.repeat(15000);
      const formatted = formatNoteContent(hugeText);
      expect(formatted.length).toBeLessThanOrEqual(10000);
    });
  });

  describe('buildEntityNotePayload', () => {
    it('constructs a valid EntityNote object with exact schema compliance', () => {
      const note = buildEntityNotePayload({
        noteId: 'note_123',
        entityId: 'ent_456',
        workspaceId: 'ws_789',
        content: 'Lead verified and ready for phone call',
        userId: 'usr_abc',
        userName: 'Admin User',
        noteType: 'call',
        isPinned: true,
        prefix: 'Lead Qualification',
      });

      expect(note.id).toBe('note_123');
      expect(note.entityId).toBe('ent_456');
      expect(note.workspaceId).toBe('ws_789');
      expect(note.content).toBe('[Lead Qualification] Lead verified and ready for phone call');
      expect(note.createdBy).toBe('usr_abc');
      expect(note.createdByName).toBe('Admin User');
      expect(note.noteType).toBe('call');
      expect(note.isPinned).toBe(true);
      expect(note.pinnedBy).toBe('usr_abc');
      expect(note.pinnedAt).toBeDefined();
      expect(note.createdAt).toBeDefined();
      expect(note.updatedAt).toBeDefined();
    });

    it('defaults noteType to general and isPinned to false when unspecified', () => {
      const note = buildEntityNotePayload({
        noteId: 'note_default',
        entityId: 'ent_456',
        workspaceId: 'ws_789',
        content: 'Standard note',
        userId: 'usr_abc',
      });

      expect(note.noteType).toBe('general');
      expect(note.isPinned).toBe(false);
      expect(note.pinnedAt).toBeUndefined();
      expect(note.content).toBe('Standard note');
    });
  });
});
