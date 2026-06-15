import { describe, it, expect } from 'vitest';
import {
  isSessionOpen,
  normalizeWaPhone,
  buildTemplateParams,
  buildTemplatePayload,
  buildTextPayload,
  decideSendMode,
} from '../whatsapp-send';

/**
 * Phase 3 — pure outbound helpers. The Meta payload shape and the 24h
 * customer-service window (spec F6) are pinned here; the engine branch and
 * orchestration are thin wrappers over these.
 */

describe('isSessionOpen (24h window)', () => {
  const now = new Date('2026-06-14T12:00:00.000Z');

  it('is open within 24h of last inbound', () => {
    expect(isSessionOpen('2026-06-14T00:00:01.000Z', now)).toBe(true);
  });

  it('is closed at exactly 24h + 1ms', () => {
    expect(isSessionOpen('2026-06-13T11:59:59.999Z', now)).toBe(false);
  });

  it('is open at exactly the 24h boundary', () => {
    expect(isSessionOpen('2026-06-13T12:00:00.000Z', now)).toBe(true);
  });

  it('is closed when there is no inbound timestamp', () => {
    expect(isSessionOpen(undefined, now)).toBe(false);
    expect(isSessionOpen('', now)).toBe(false);
  });
});

describe('normalizeWaPhone', () => {
  it('strips formatting and the leading +', () => {
    expect(normalizeWaPhone('+233 20 000 0000')).toBe('233200000000');
    expect(normalizeWaPhone('+1 (202) 555-0123')).toBe('12025550123');
  });
  it('leaves already-bare digits intact', () => {
    expect(normalizeWaPhone('233200000000')).toBe('233200000000');
  });
});

describe('buildTemplateParams', () => {
  it('resolves positional params from variables in order', () => {
    expect(buildTemplateParams(['firstName', 'code'], { firstName: 'Ama', code: '123' })).toEqual([
      'Ama',
      '123',
    ]);
  });
  it('coerces missing/non-string values to empty/string', () => {
    expect(buildTemplateParams(['a', 'b', 'c'], { a: 0, b: null })).toEqual(['0', '', '']);
  });
});

describe('buildTemplatePayload', () => {
  it('produces a Meta template message with body params', () => {
    const p = buildTemplatePayload({
      to: '233200000000',
      name: 'order_update',
      language: 'en_US',
      params: ['Ama', 'shipped'],
    });
    expect(p).toEqual({
      messaging_product: 'whatsapp',
      to: '233200000000',
      type: 'template',
      template: {
        name: 'order_update',
        language: { code: 'en_US' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: 'Ama' },
              { type: 'text', text: 'shipped' },
            ],
          },
        ],
      },
    });
  });

  it('omits the components array when there are no params', () => {
    const p = buildTemplatePayload({ to: '2332', name: 'hello', language: 'en', params: [] });
    expect(p.template.components).toBeUndefined();
  });
});

describe('buildTextPayload', () => {
  it('produces a Meta text message', () => {
    expect(buildTextPayload('2332', 'hi there')).toEqual({
      messaging_product: 'whatsapp',
      to: '2332',
      type: 'text',
      text: { body: 'hi there' },
    });
  });
});

describe('decideSendMode', () => {
  it('uses the template when one is bound', () => {
    expect(decideSendMode({ hasTemplate: true, sessionOpen: false })).toBe('template');
    expect(decideSendMode({ hasTemplate: true, sessionOpen: true })).toBe('template');
  });
  it('sends free-form text only inside an open session', () => {
    expect(decideSendMode({ hasTemplate: false, sessionOpen: true })).toBe('text');
  });
  it('blocks free-form text outside the window', () => {
    expect(decideSendMode({ hasTemplate: false, sessionOpen: false })).toBe('blocked');
  });
});
