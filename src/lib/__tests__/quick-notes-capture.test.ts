import { describe, it, expect } from 'vitest';
import {
  calculateReadingStats,
  resolveDraftStorageKey,
  plainTextToTipTap,
  extractPlainText,
} from '../quick-notes-domain';
import { DEFAULT_TEMPLATE_PRESETS } from '../knowledge-template-presets';
import { KNOWLEDGE_TYPES } from '../quick-notes-types';

describe('Phase 2: Universal Capture & Reading Statistics', () => {
  it('calculates reading statistics accurately', () => {
    expect(calculateReadingStats('')).toEqual({
      words: 0,
      characters: 0,
      readingTimeMinutes: 1,
    });

    const sampleText = 'This is a test note containing exactly eight words.';
    const stats = calculateReadingStats(sampleText);
    expect(stats.words).toBe(9);
    expect(stats.characters).toBe(sampleText.length);
    expect(stats.readingTimeMinutes).toBe(1);

    const longText = new Array(450).fill('word').join(' ');
    const longStats = calculateReadingStats(longText);
    expect(longStats.words).toBe(450);
    expect(longStats.readingTimeMinutes).toBe(3);
  });

  it('builds scoped draft storage keys safely', () => {
    expect(resolveDraftStorageKey('ws-123')).toBe('smartsapp_draft_ws-123_global');
    expect(resolveDraftStorageKey('ws-123', 'entity-456')).toBe('smartsapp_draft_ws-123_entity-456');
    expect(resolveDraftStorageKey('', '')).toBe('smartsapp_draft_default_global');
  });

  it('verifies all 6 foundational template presets have valid schemas and TipTap content', () => {
    expect(DEFAULT_TEMPLATE_PRESETS).toHaveLength(6);

    for (const preset of DEFAULT_TEMPLATE_PRESETS) {
      expect(preset.name).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(KNOWLEDGE_TYPES).toContain(preset.knowledgeType);
      expect(preset.content.type).toBe('doc');
      expect(Array.isArray(preset.content.content)).toBe(true);

      const plain = extractPlainText(preset.content);
      expect(plain.length).toBeGreaterThan(10);
    }
  });

  it('roundtrips boilerplate text through TipTap parser and plain text extractor', () => {
    const raw = '### Title\nLine 1\n\nLine 2';
    const doc = plainTextToTipTap(raw);
    const roundtrip = extractPlainText(doc);
    expect(roundtrip).toContain('Title');
    expect(roundtrip).toContain('Line 1');
    expect(roundtrip).toContain('Line 2');
  });
});
