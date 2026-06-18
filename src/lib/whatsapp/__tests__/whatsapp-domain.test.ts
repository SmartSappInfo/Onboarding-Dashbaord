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
  validateApprovedSend,
  validateHeaderMedia,
  parseTemplateStatusEvents,
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

describe('media headers & buttons', () => {
  const base: CreateTemplateInput = {
    name: 'receipt',
    language: 'en_US',
    category: 'UTILITY',
    bodyText: 'Thanks for your order.',
  };

  it('rejects a media header with no handle', () => {
    const r = validateCreateTemplateInput({ ...base, mediaHeader: { format: 'IMAGE', handle: '' } });
    expect(r.valid).toBe(false);
  });

  it('rejects more than 10 buttons', () => {
    const buttons = Array.from({ length: 11 }, (_, i) => ({ type: 'QUICK_REPLY' as const, text: `b${i}` }));
    expect(validateCreateTemplateInput({ ...base, buttons }).valid).toBe(false);
  });

  it('rejects a URL button missing its URL', () => {
    const r = validateCreateTemplateInput({
      ...base,
      buttons: [{ type: 'URL', text: 'Visit', url: '' }],
    });
    expect(r.valid).toBe(false);
  });

  it('rejects a {{1}} URL with no sample', () => {
    const r = validateCreateTemplateInput({
      ...base,
      buttons: [{ type: 'URL', text: 'Track', url: 'https://x.co/{{1}}' }],
    });
    expect(r.valid).toBe(false);
  });

  it('accepts a valid mix of buttons', () => {
    const r = validateCreateTemplateInput({
      ...base,
      buttons: [
        { type: 'QUICK_REPLY', text: 'Yes' },
        { type: 'URL', text: 'Track', url: 'https://x.co/{{1}}', urlExample: 'https://x.co/123' },
        { type: 'PHONE_NUMBER', text: 'Call', phoneNumber: '+233200000000' },
      ],
    });
    expect(r.valid).toBe(true);
  });

  it('builds a media HEADER with header_handle (precedence over text)', () => {
    const p = buildCreateTemplatePayload({
      ...base,
      headerText: 'ignored',
      mediaHeader: { format: 'IMAGE', handle: 'HANDLE_123' },
    });
    const header = p.components.find((c) => c.type === 'HEADER');
    expect(header?.format).toBe('IMAGE');
    expect(header?.text).toBeUndefined();
    expect(header?.example?.header_handle).toEqual(['HANDLE_123']);
  });

  it('emits BUTTONS last with correct wire shape', () => {
    const p = buildCreateTemplatePayload({
      ...base,
      footerText: 'MineX360',
      buttons: [
        { type: 'QUICK_REPLY', text: 'Yes' },
        { type: 'URL', text: 'Track', url: 'https://x.co/{{1}}', urlExample: 'https://x.co/123' },
        { type: 'PHONE_NUMBER', text: 'Call', phoneNumber: '+233200000000' },
      ],
    });
    expect(p.components[p.components.length - 1].type).toBe('BUTTONS');
    const btns = p.components.find((c) => c.type === 'BUTTONS')!.buttons!;
    expect(btns[0]).toEqual({ type: 'QUICK_REPLY', text: 'Yes' });
    expect(btns[1]).toMatchObject({ type: 'URL', url: 'https://x.co/{{1}}', example: ['https://x.co/123'] });
    expect(btns[2]).toMatchObject({ type: 'PHONE_NUMBER', phone_number: '+233200000000' });
  });
});

describe('validateHeaderMedia', () => {
  it('accepts a JPEG within the size cap and derives IMAGE', () => {
    const r = validateHeaderMedia('image/jpeg', 1024);
    expect(r.valid).toBe(true);
    expect(r.format).toBe('IMAGE');
  });

  it('derives VIDEO and DOCUMENT formats', () => {
    expect(validateHeaderMedia('video/mp4', 1024).format).toBe('VIDEO');
    expect(validateHeaderMedia('application/pdf', 1024).format).toBe('DOCUMENT');
  });

  it('is case-insensitive on MIME type', () => {
    expect(validateHeaderMedia('IMAGE/PNG', 1024).valid).toBe(true);
  });

  it('rejects an unsupported type', () => {
    expect(validateHeaderMedia('image/gif', 1024).valid).toBe(false);
  });

  it('rejects an empty file', () => {
    expect(validateHeaderMedia('image/png', 0).valid).toBe(false);
  });

  it('rejects a file over the per-format cap', () => {
    expect(validateHeaderMedia('image/png', 6 * 1024 * 1024).valid).toBe(false); // >5MB image cap
  });
});

describe('validateApprovedSend', () => {
  const approved = { organizationId: 'org_1', status: 'APPROVED' as const, paramCount: 2 };

  it('allows an approved template for its own org with the right param count', () => {
    expect(validateApprovedSend(approved, 'org_1', 2).valid).toBe(true);
  });

  it('rejects a missing template', () => {
    expect(validateApprovedSend(null, 'org_1', 0).valid).toBe(false);
  });

  it('rejects a template from another org', () => {
    expect(validateApprovedSend(approved, 'org_2', 2).valid).toBe(false);
  });

  it('rejects a non-approved template', () => {
    const r = validateApprovedSend({ ...approved, status: 'PENDING' }, 'org_1', 2);
    expect(r.valid).toBe(false);
    expect(r.error).toContain('PENDING');
  });

  it('rejects a param-count mismatch', () => {
    const r = validateApprovedSend(approved, 'org_1', 1);
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Expected 2');
  });
});

describe('parseTemplateStatusEvents', () => {
  const statusBody = (event: string, reason?: string) => ({
    entry: [
      {
        id: 'WABA_1',
        changes: [
          {
            field: 'message_template_status_update',
            value: {
              event,
              message_template_id: 9001,
              message_template_name: 'order_update',
              message_template_language: 'en_US',
              ...(reason ? { reason } : {}),
            },
          },
        ],
      },
    ],
  });

  it('parses an APPROVED status with the WABA id from entry.id', () => {
    const [ev] = parseTemplateStatusEvents(statusBody('APPROVED'));
    expect(ev).toMatchObject({
      wabaId: 'WABA_1',
      metaTemplateId: '9001',
      name: 'order_update',
      language: 'en_US',
      status: 'APPROVED',
    });
    expect(ev.rejectedReason).toBeUndefined();
  });

  it('carries the rejected reason on REJECTED', () => {
    const [ev] = parseTemplateStatusEvents(statusBody('REJECTED', 'INVALID_FORMAT'));
    expect(ev.status).toBe('REJECTED');
    expect(ev.rejectedReason).toBe('INVALID_FORMAT');
  });

  it('omits a "NONE" reason', () => {
    const [ev] = parseTemplateStatusEvents(statusBody('APPROVED', 'NONE'));
    expect(ev.rejectedReason).toBeUndefined();
  });

  it('parses a category update without forcing a status', () => {
    const [ev] = parseTemplateStatusEvents({
      entry: [
        {
          id: 'WABA_1',
          changes: [
            {
              field: 'template_category_update',
              value: {
                message_template_id: 9001,
                message_template_name: 'order_update',
                new_category: 'UTILITY',
              },
            },
          ],
        },
      ],
    });
    expect(ev.category).toBe('UTILITY');
    expect(ev.status).toBeUndefined();
  });

  it('ignores unrelated fields and malformed bodies', () => {
    expect(parseTemplateStatusEvents({ entry: [{ id: 'W', changes: [{ field: 'messages', value: {} }] }] })).toEqual([]);
    expect(parseTemplateStatusEvents(null)).toEqual([]);
    expect(parseTemplateStatusEvents({})).toEqual([]);
  });

  it('skips changes without a template id', () => {
    expect(
      parseTemplateStatusEvents({
        entry: [{ id: 'W', changes: [{ field: 'message_template_status_update', value: { event: 'APPROVED' } }] }],
      }),
    ).toEqual([]);
  });
});
