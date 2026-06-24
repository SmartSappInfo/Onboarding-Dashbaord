import { describe, it, expect } from 'vitest';
import type { CampaignPageStructure } from '@/lib/types';
import { migrateLegacyStructure } from '../migrate';
import { parseStructure } from '../schema';
import fixture from '@/app/p/[slug]/payment-guide-data.json';

function legacy(): CampaignPageStructure {
  return {
    sections: [
      { id: 'hero-section', type: 'section', props: {}, blocks: [] },
      { id: 'payment-methods-section', type: 'section', props: {}, blocks: [] },
      { id: 'procedure-section', type: 'section', props: {}, blocks: [] },
      { id: 'cta-section', type: 'section', props: {}, blocks: [] },
    ],
  };
}

function headingFor(structure: CampaignPageStructure, id: string): unknown {
  return structure.sections.find((s) => s.id === id)?.props.heading;
}

describe('migrateLegacyStructure', () => {
  it('maps legacy section ids to headings', () => {
    const m = migrateLegacyStructure(legacy());
    expect(headingFor(m, 'payment-methods-section')).toBe('Bank Details');
    expect(headingFor(m, 'procedure-section')).toBe('Payment Procedure');
    expect(headingFor(m, 'cta-section')).toBe('Complete Payment');
  });

  it('leaves the hero section without a heading', () => {
    const m = migrateLegacyStructure(legacy());
    expect(headingFor(m, 'hero-section')).toBeUndefined();
  });

  it('does not overwrite an existing heading', () => {
    const input = legacy();
    input.sections[1].props.heading = 'Custom';
    const m = migrateLegacyStructure(input);
    expect(headingFor(m, 'payment-methods-section')).toBe('Custom');
  });

  it('is idempotent (returns same reference when nothing changes)', () => {
    const once = migrateLegacyStructure(legacy());
    const twice = migrateLegacyStructure(once);
    expect(twice).toBe(once);
  });

  it('migrates the real payment fixture so its sections gain headings', () => {
    const migrated = migrateLegacyStructure(parseStructure(fixture.version.structureJson));
    expect(headingFor(migrated, 'payment-methods-section')).toBe('Bank Details');
    expect(headingFor(migrated, 'procedure-section')).toBe('Payment Procedure');
  });
});
