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
  buildAdoptedWhatsAppMessageTemplate,
  adoptedTemplateDocId,
  shouldAutoEnableWhatsApp,
  toPositionalBody,
  stripComponentExamples,
  validateApprovedSend,
  validateHeaderMedia,
  getTemplateRuntimeNeeds,
  hasRuntimeNeeds,
  isLikelyHttpUrl,
  parseTemplateStatusEvents,
  type MetaTemplateRaw,
  type CreateTemplateInput,
} from '../whatsapp-domain';
import type { WhatsAppTemplate } from '../whatsapp-types';

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

  it('strips Meta example fields so the stored doc has no nested arrays (Firestore-safe)', () => {
    const t = normalizeMetaTemplate(
      'org_1',
      {
        ...raw,
        components: [
          { type: 'BODY', text: 'Hi {{1}}', example: { body_text: [['John']] } },
          { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'Go', url: 'https://x/{{1}}', example: ['https://x/1'] }] },
        ],
      },
      'NOW',
    );
    const body = (t.components as Array<Record<string, unknown>>).find((c) => c.type === 'BODY')!;
    const buttonsComp = (t.components as Array<Record<string, unknown>>).find((c) => c.type === 'BUTTONS')!;
    expect('example' in body).toBe(false);
    expect(body.text).toBe('Hi {{1}}'); // content preserved
    expect('example' in (buttonsComp.buttons as Array<Record<string, unknown>>)[0]).toBe(false);
    // No value anywhere in components is an array-of-arrays.
    const hasNestedArray = JSON.stringify(t.components).includes('[[');
    expect(hasNestedArray).toBe(false);
  });
});

describe('buildAdoptedWhatsAppMessageTemplate', () => {
  const wa: WhatsAppTemplate = {
    id: 'org1_order_update_en_US',
    organizationId: 'org1',
    metaTemplateId: 'meta_1',
    name: 'order_update',
    language: 'en_US',
    category: 'UTILITY',
    status: 'APPROVED',
    components: [{ type: 'BODY', text: 'Hi {{1}}, order {{2}}' }],
    paramCount: 2,
    syncedAt: 'NOW',
  };

  it('builds a sendable whatsapp message_templates doc with a deterministic id', () => {
    const t = buildAdoptedWhatsAppMessageTemplate(wa, { paramMap: ['firstName', 'orderId'], createdBy: 'u1', now: 'T' });
    expect(t.id).toBe('wa_org1_order_update_en_US');
    expect(t.id).toBe(adoptedTemplateDocId(wa.id));
    expect(t.channel).toBe('whatsapp');
    expect(t.contentMode).toBe('template');
    expect(t.whatsappTemplateName).toBe('order_update');
    expect(t.whatsappLanguage).toBe('en_US');
    expect(t.whatsappParamMap).toEqual(['firstName', 'orderId']);
    expect(t.declaredVariables).toEqual(['firstName', 'orderId']);
    expect(t.body).toBe('Hi {{1}}, order {{2}}');
    expect(t.status).toBe('active');
    expect(t.createdBy).toBe('u1');
  });

  it('prefers explicit opts, then stored classification, then defaults', () => {
    const stored = buildAdoptedWhatsAppMessageTemplate(
      { ...wa, appCategory: 'reminders', templateType: 'due_soon' },
      { paramMap: [] },
    );
    expect(stored.category).toBe('reminders');
    expect(stored.templateType).toBe('due_soon');

    const overridden = buildAdoptedWhatsAppMessageTemplate(
      { ...wa, appCategory: 'reminders', templateType: 'due_soon' },
      { paramMap: [], appCategory: 'campaigns', templateType: 'promo' },
    );
    expect(overridden.category).toBe('campaigns');
    expect(overridden.templateType).toBe('promo');

    const fallback = buildAdoptedWhatsAppMessageTemplate(wa, { paramMap: [] });
    expect(fallback.category).toBe('general');
    expect(fallback.templateType).toBe('whatsapp');
  });
});

describe('shouldAutoEnableWhatsApp', () => {
  const base: WhatsAppTemplate = {
    id: 'org1_t_en', organizationId: 'org1', metaTemplateId: 'm', name: 't', language: 'en',
    category: 'UTILITY', status: 'APPROVED', components: [{ type: 'BODY', text: 'Hi {{1}}' }],
    paramCount: 1, syncedAt: 'NOW',
  };

  it('enables an approved zero-param template', () => {
    expect(shouldAutoEnableWhatsApp({ ...base, paramCount: 0, components: [{ type: 'BODY', text: 'Hi' }] })).toBe(true);
  });

  it('enables an approved parametrized template only when a complete map exists', () => {
    expect(shouldAutoEnableWhatsApp(base)).toBe(false); // no map
    expect(shouldAutoEnableWhatsApp({ ...base, paramMap: ['firstName'] })).toBe(true);
    expect(shouldAutoEnableWhatsApp({ ...base, paramMap: [] })).toBe(false); // wrong length
  });

  it('never enables non-approved or media/dynamic templates', () => {
    expect(shouldAutoEnableWhatsApp({ ...base, status: 'PENDING', paramMap: ['x'] })).toBe(false);
    expect(shouldAutoEnableWhatsApp({
      ...base, paramCount: 0,
      components: [{ type: 'HEADER', format: 'IMAGE' }, { type: 'BODY', text: 'hi' }],
    })).toBe(false);
  });
});

describe('stripComponentExamples', () => {
  it('removes example keys from components and buttons, leaving everything else intact', () => {
    const out = stripComponentExamples([
      { type: 'HEADER', format: 'IMAGE', example: { header_handle: ['h'] } },
      { type: 'BODY', text: 'Hi {{1}}', example: { body_text: [['Ama']] } },
      { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'Go', url: 'u', example: ['u1'] }] },
    ]);
    expect(out).toEqual([
      { type: 'HEADER', format: 'IMAGE' },
      { type: 'BODY', text: 'Hi {{1}}' },
      { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'Go', url: 'u' }] },
    ]);
  });

  it('returns [] for undefined and tolerates non-object entries', () => {
    expect(stripComponentExamples(undefined)).toEqual([]);
    expect(stripComponentExamples(['x', null])).toEqual(['x', null]);
  });
});

describe('toPositionalBody', () => {
  it('rewrites named variables to positional params in order of appearance', () => {
    const r = toPositionalBody('Hi {{firstName}}, order {{orderId}} is ready.');
    expect(r.text).toBe('Hi {{1}}, order {{2}} is ready.');
    expect(r.paramMap).toEqual(['firstName', 'orderId']);
  });

  it('reuses one index for a variable repeated in the body', () => {
    const r = toPositionalBody('{{name}} — thanks {{name}}!');
    expect(r.text).toBe('{{1}} — thanks {{1}}!');
    expect(r.paramMap).toEqual(['name']);
  });

  it('tolerates whitespace inside the braces', () => {
    const r = toPositionalBody('Hi {{  firstName  }} there');
    expect(r.text).toBe('Hi {{1}} there');
    expect(r.paramMap).toEqual(['firstName']);
  });

  it('escapes regex-significant characters in variable names', () => {
    const r = toPositionalBody('Value {{user.name}} and {{a+b}}');
    expect(r.text).toBe('Value {{1}} and {{2}}');
    expect(r.paramMap).toEqual(['user.name', 'a+b']);
  });

  it('only replaces exact tokens, never prefixes of longer names', () => {
    const r = toPositionalBody('{{a}} then {{ab}}');
    expect(r.text).toBe('{{1}} then {{2}}');
    expect(r.paramMap).toEqual(['a', 'ab']);
  });

  it('returns the body unchanged when there are no variables', () => {
    const r = toPositionalBody('Static message');
    expect(r.text).toBe('Static message');
    expect(r.paramMap).toEqual([]);
  });

  it('handles empty input safely', () => {
    expect(toPositionalBody('')).toEqual({ text: '', paramMap: [] });
  });

  it('is stable when called repeatedly (no leaked regex state)', () => {
    const body = 'Hi {{firstName}} and {{lastName}}';
    const a = toPositionalBody(body);
    const b = toPositionalBody(body);
    expect(a).toEqual(b);
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

  // ── Meta-documented rejection rules ──────────────────────────────────────
  // Source: developers.facebook.com › whatsapp › templates › template-review
  // "templates cannot start or end with a parameter".
  it('rejects a body that starts with a parameter', () => {
    const r = validateCreateTemplateInput({
      ...base,
      bodyText: '{{1}} your order is ready.',
      bodyExample: ['John'],
    });
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/start/i);
  });

  it('rejects a body that ends with a parameter', () => {
    const r = validateCreateTemplateInput({
      ...base,
      bodyText: 'Your order number is {{1}}',
      bodyExample: ['123'],
    });
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/end/i);
  });

  it('rejects a body longer than the Meta limit', () => {
    const r = validateCreateTemplateInput({
      ...base,
      bodyText: `Hi ${'x'.repeat(1100)}`,
      bodyExample: [],
    });
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/1024/);
  });

  it('rejects a name longer than the Meta limit', () => {
    const r = validateCreateTemplateInput({ ...base, name: 'a'.repeat(513) });
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/512/);
  });

  it('rejects a malformed language code', () => {
    const r = validateCreateTemplateInput({ ...base, language: 'English' });
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/language/i);
  });

  it('rejects a category this builder cannot author', () => {
    const r = validateCreateTemplateInput({ ...base, category: 'AUTHENTICATION' });
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/authentication/i);
  });

  it('rejects header and footer text beyond Meta limits', () => {
    expect(validateCreateTemplateInput({ ...base, headerText: 'h'.repeat(61) }).valid).toBe(false);
    expect(validateCreateTemplateInput({ ...base, footerText: 'f'.repeat(61) }).valid).toBe(false);
  });

  // Flagged by Meta review but not auto-rejected → warn, never block.
  it('warns about characters Meta flags without blocking submission', () => {
    const r = validateCreateTemplateInput({
      ...base,
      bodyText: 'Hi {{1}}, save 50% today on order {{2}} ok',
      bodyExample: ['John', 'A1'],
    });
    expect(r.valid).toBe(true);
    expect(r.warnings?.join(' ')).toMatch(/%/);
  });

  it('reports no warnings for a clean body', () => {
    const r = validateCreateTemplateInput(base);
    expect(r.valid).toBe(true);
    expect(r.warnings ?? []).toHaveLength(0);
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

  // Meta supports 'named' and 'positional' parameter formats and defaults to
  // positional. We author positional {{1}}..{{n}}, so declare it explicitly
  // rather than relying on the default.
  it('declares the positional parameter format explicitly', () => {
    const p = buildCreateTemplatePayload({
      name: 'order_update',
      language: 'en_US',
      category: 'UTILITY',
      bodyText: 'Hi {{1}}',
      bodyExample: ['John'],
    });
    expect(p.parameter_format).toBe('positional');
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

describe('getTemplateRuntimeNeeds', () => {
  it('detects a media header format', () => {
    const needs = getTemplateRuntimeNeeds([
      { type: 'HEADER', format: 'IMAGE', example: { header_handle: ['h'] } },
      { type: 'BODY', text: 'hi' },
    ]);
    expect(needs.mediaFormat).toBe('IMAGE');
    expect(needs.dynamicUrlButtons).toEqual([]);
  });

  it('ignores a TEXT header', () => {
    const needs = getTemplateRuntimeNeeds([{ type: 'HEADER', format: 'TEXT', text: 'Hi' }]);
    expect(needs.mediaFormat).toBeUndefined();
  });

  it('flags only dynamic {{1}} URL buttons by index', () => {
    const needs = getTemplateRuntimeNeeds([
      { type: 'BODY', text: 'hi' },
      {
        type: 'BUTTONS',
        buttons: [
          { type: 'QUICK_REPLY', text: 'Yes' },
          { type: 'URL', text: 'Track', url: 'https://x.co/{{1}}' },
          { type: 'URL', text: 'Home', url: 'https://x.co' },
        ],
      },
    ]);
    expect(needs.dynamicUrlButtons).toEqual([1]);
  });

  it('returns empty needs for body-only or undefined', () => {
    expect(getTemplateRuntimeNeeds([{ type: 'BODY', text: 'hi' }])).toEqual({ dynamicUrlButtons: [] });
    expect(getTemplateRuntimeNeeds(undefined)).toEqual({ dynamicUrlButtons: [] });
  });

  it('hasRuntimeNeeds is true for media or dynamic buttons, false otherwise', () => {
    expect(hasRuntimeNeeds({ mediaFormat: 'IMAGE', dynamicUrlButtons: [] })).toBe(true);
    expect(hasRuntimeNeeds({ dynamicUrlButtons: [1] })).toBe(true);
    expect(hasRuntimeNeeds({ dynamicUrlButtons: [] })).toBe(false);
  });
});

describe('isLikelyHttpUrl', () => {
  it('accepts absolute http(s) URLs (incl. a {{1}} path)', () => {
    expect(isLikelyHttpUrl('https://example.com')).toBe(true);
    expect(isLikelyHttpUrl('http://x.co/path')).toBe(true);
    expect(isLikelyHttpUrl('https://x.co/{{1}}')).toBe(true);
    expect(isLikelyHttpUrl('  https://x.co  ')).toBe(true);
  });

  it('rejects non-http, relative, or malformed input', () => {
    expect(isLikelyHttpUrl('example.com')).toBe(false);
    expect(isLikelyHttpUrl('ftp://x.co')).toBe(false);
    expect(isLikelyHttpUrl('not a url')).toBe(false);
    expect(isLikelyHttpUrl('')).toBe(false);
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
