import { describe, it, expect } from 'vitest';
import {
  extractParamIndices,
  extractParamCount,
  getBodyText,
  deriveParamCount,
  validateParamMap,
  buildWhatsAppTemplateId,
  normalizeMetaTemplate,
  validateCreateTemplateInput,
  buildCreateTemplatePayload,
  type MetaTemplateRaw,
  type CreateTemplateInput,
} from '../whatsapp-domain';

/**
 * Phase 2 — pure template parsing/normalization. WhatsApp templates use
 * positional {{n}} params and a Meta-defined component structure; getting the
 * param count / mapping wrong means malformed sends, so this is pinned hard.
 */

describe('param extraction', () => {
  it('counts the highest positional index', () => {
    expect(extractParamCount('Hi {{1}}, your code is {{2}}')).toBe(2);
    expect(extractParamCount('No params here')).toBe(0);
    expect(extractParamCount('{{1}} and {{1}} again')).toBe(1);
  });

  it('uses the max index even with gaps (defensive)', () => {
    expect(extractParamCount('Only {{3}}')).toBe(3);
  });

  it('tolerates whitespace inside braces', () => {
    expect(extractParamIndices('Hi {{ 1 }} and {{2}}')).toEqual([1, 2]);
  });
});

describe('component helpers', () => {
  const components = [
    { type: 'HEADER', format: 'TEXT', text: 'Welcome' },
    { type: 'BODY', text: 'Hello {{1}}, see you on {{2}}.' },
    { type: 'FOOTER', text: 'Reply STOP to opt out' },
  ];

  it('getBodyText returns the BODY component text', () => {
    expect(getBodyText(components)).toBe('Hello {{1}}, see you on {{2}}.');
    expect(getBodyText([])).toBe('');
  });

  it('deriveParamCount counts BODY params only', () => {
    expect(deriveParamCount(components)).toBe(2);
  });
});

describe('validateParamMap', () => {
  it('passes when length matches and all mapped', () => {
    expect(validateParamMap(['firstName', 'eventDate'], 2)).toEqual({ valid: true });
  });

  it('fails on count mismatch', () => {
    const r = validateParamMap(['firstName'], 2);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/2 parameter/);
  });

  it('fails when a slot is empty', () => {
    expect(validateParamMap(['firstName', '  '], 2).valid).toBe(false);
  });

  it('passes empty map for zero-param templates', () => {
    expect(validateParamMap([], 0)).toEqual({ valid: true });
    expect(validateParamMap(undefined, 0)).toEqual({ valid: true });
  });
});

describe('buildWhatsAppTemplateId', () => {
  it('composes org + name + language', () => {
    expect(buildWhatsAppTemplateId('org_1', 'welcome', 'en_US')).toBe('org_1_welcome_en_US');
  });
});

describe('normalizeMetaTemplate', () => {
  const raw: MetaTemplateRaw = {
    id: 'meta_99',
    name: 'order_update',
    language: 'en_US',
    category: 'UTILITY',
    status: 'APPROVED',
    components: [{ type: 'BODY', text: 'Order {{1}} is {{2}}' }],
  };

  it('maps fields and derives paramCount + id', () => {
    const t = normalizeMetaTemplate('org_1', raw, '2026-06-14T00:00:00.000Z');
    expect(t.id).toBe('org_1_order_update_en_US');
    expect(t.organizationId).toBe('org_1');
    expect(t.metaTemplateId).toBe('meta_99');
    expect(t.status).toBe('APPROVED');
    expect(t.category).toBe('UTILITY');
    expect(t.paramCount).toBe(2);
    expect(t.syncedAt).toBe('2026-06-14T00:00:00.000Z');
  });

  it('carries the rejected reason when present', () => {
    const t = normalizeMetaTemplate(
      'org_1',
      { ...raw, status: 'REJECTED', rejected_reason: 'INVALID_FORMAT' },
      'NOW',
    );
    expect(t.status).toBe('REJECTED');
    expect(t.rejectedReason).toBe('INVALID_FORMAT');
  });
});

describe('validateCreateTemplateInput', () => {
  const base: CreateTemplateInput = {
    name: 'order_update',
    language: 'en_US',
    category: 'UTILITY',
    bodyText: 'Hi {{1}}, your order {{2}} is ready.',
    bodyExample: ['John', '#123'],
  };

  it('accepts a valid template with matching examples', () => {
    expect(validateCreateTemplateInput(base).valid).toBe(true);
  });

  it('rejects an invalid name', () => {
    const r = validateCreateTemplateInput({ ...base, name: 'Order Update' });
    expect(r.valid).toBe(false);
  });

  it('requires a sample value per body param', () => {
    const r = validateCreateTemplateInput({ ...base, bodyExample: ['John'] });
    expect(r.valid).toBe(false);
  });

  it('rejects non-contiguous params (gap)', () => {
    const r = validateCreateTemplateInput({
      ...base,
      bodyText: 'Hi {{1}} {{3}}',
      bodyExample: ['a', 'b'],
    });
    expect(r.valid).toBe(false);
  });

  it('accepts a param-free body with no examples', () => {
    const r = validateCreateTemplateInput({ ...base, bodyText: 'Static body', bodyExample: [] });
    expect(r.valid).toBe(true);
  });
});

describe('buildCreateTemplatePayload', () => {
  it('emits HEADER/BODY/FOOTER with a body example', () => {
    const p = buildCreateTemplatePayload({
      name: 'order_update',
      language: 'en_US',
      category: 'UTILITY',
      headerText: 'Order update',
      bodyText: 'Hi {{1}}',
      bodyExample: ['John'],
      footerText: 'MineX360',
    });
    expect(p.name).toBe('order_update');
    expect(p.components.map((c) => c.type)).toEqual(['HEADER', 'BODY', 'FOOTER']);
    const body = p.components.find((c) => c.type === 'BODY');
    expect(body?.example?.body_text).toEqual([['John']]);
  });

  it('omits the example when the body has no params', () => {
    const p = buildCreateTemplatePayload({
      name: 'welcome',
      language: 'en',
      category: 'MARKETING',
      bodyText: 'Welcome aboard!',
    });
    const body = p.components.find((c) => c.type === 'BODY');
    expect(body?.example).toBeUndefined();
    expect(p.components).toHaveLength(1);
  });
});
