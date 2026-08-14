import { describe, it, expect } from 'vitest';
import fixture from '@/app/p/[slug]/subscription-renewal-data.json';

describe('subscription renewal fixture', () => {
  it('exposes page and version with a section structure', () => {
    expect(fixture).toHaveProperty('page');
    expect(fixture.page.slug).toBe('subscription-renewal');
    expect(fixture).toHaveProperty('version.structureJson.sections');
    expect(Array.isArray(fixture.version.structureJson.sections)).toBe(true);
  });

  it('contains hero, payment-methods, and cta sections, but NO procedure section', () => {
    const ids = fixture.version.structureJson.sections.map((s) => s.id);
    expect(ids).toContain('hero-section');
    expect(ids).toContain('payment-methods-section');
    expect(ids).toContain('cta-section');
    expect(ids).not.toContain('procedure-section');
  });

  it('does NOT contain procedure_list block anywhere', () => {
    const types = fixture.version.structureJson.sections.flatMap((s) =>
      s.blocks.map((b) => b.type)
    );
    expect(types).toContain('payment_methods');
    expect(types).not.toContain('procedure_list');
  });

  it('contains the updated Zenith Bank details', () => {
    const section = fixture.version.structureJson.sections.find(
      (s) => s.id === 'payment-methods-section'
    );
    const block = section?.blocks.find((b) => b.id === 'bank-details') as any;
    const details = block?.props?.methods?.[0]?.details;

    expect(details).toEqual([
      { label: 'Account Name', value: 'SmartSapp Innovations Ltd.' },
      { label: 'Account No.', value: '6110137316' },
      { label: 'Bank', value: 'Zenith Bank' },
      { label: 'Branch', value: 'Head Office' },
    ]);
  });

  it('configures header and CTA button with Confirm Payment', () => {
    const header = (fixture.version.structureJson as any).header;
    expect(header).toBeDefined();
    expect(header.showCta).toBe(true);
    expect(header.buttons[0].label).toBe('Confirm Payment');
    expect(header.buttons[0].action).toBe('receipt_request');

    const ctaSection = fixture.version.structureJson.sections.find((s) => s.id === 'cta-section');
    expect(ctaSection?.props.heading).toBe('Confirm Payment');
    const ctaBlock = ctaSection?.blocks.find((b) => b.id === 'cta-1');
    expect(ctaBlock?.props.label).toBe('Confirm Payment');
  });
});
