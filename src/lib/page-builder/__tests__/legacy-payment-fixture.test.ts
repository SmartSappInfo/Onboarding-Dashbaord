import { describe, it, expect } from 'vitest';
import fixture from '@/app/p/[slug]/payment-guide-data.json';

/**
 * The `subscription-payment` page is the only currently-live published page and
 * is served from this static fixture (not Firestore). It relies on legacy
 * structural assumptions (section ids `hero-section` / `payment-methods-section`
 * / `procedure-section`, and the `payment_methods` / `procedure_list` block
 * types). This test locks that shape so Phase 0's data-path change — and the
 * later renderer/migration work — cannot silently break it.
 */
describe('legacy payment fixture', () => {
  it('exposes page and version with a section structure', () => {
    expect(fixture).toHaveProperty('page');
    expect(fixture).toHaveProperty('version.structureJson.sections');
    expect(Array.isArray(fixture.version.structureJson.sections)).toBe(true);
  });

  it('retains the legacy section ids the current renderer keys off', () => {
    const ids = fixture.version.structureJson.sections.map((s) => s.id);
    expect(ids).toContain('hero-section');
    expect(ids).toContain('payment-methods-section');
    expect(ids).toContain('procedure-section');
  });

  it('contains the payment_methods and procedure_list blocks', () => {
    const types = fixture.version.structureJson.sections.flatMap((s) =>
      s.blocks.map((b) => b.type),
    );
    expect(types).toContain('payment_methods');
    expect(types).toContain('procedure_list');
  });
});
