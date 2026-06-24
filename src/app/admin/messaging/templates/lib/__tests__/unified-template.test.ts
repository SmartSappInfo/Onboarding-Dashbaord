import { describe, it, expect } from 'vitest';
import type { MessageTemplate } from '@/lib/types';
import type { WhatsAppTemplate, WhatsAppTemplateStatus } from '@/lib/whatsapp/whatsapp-types';
import {
  mapWhatsAppToGallery,
  partitionAdopted,
  mergeGalleryTemplates,
  isWhatsAppDisplay,
  toWhatsAppTemplateName,
} from '../unified-template';

/** Minimal WhatsAppTemplate factory — only the fields the adapter reads. */
function makeWa(overrides: Partial<WhatsAppTemplate> = {}): WhatsAppTemplate {
  return {
    id: 'org1_order_update_en_US',
    organizationId: 'org1',
    metaTemplateId: 'meta-1',
    name: 'order_update',
    language: 'en_US',
    category: 'UTILITY',
    status: 'APPROVED',
    components: [{ type: 'BODY', text: 'Hi {{1}}, your order {{2}} shipped.' }],
    paramCount: 2,
    syncedAt: '2026-06-20T00:00:00.000Z',
    ...overrides,
  };
}

/** Minimal MessageTemplate factory. */
function makeMsg(overrides: Partial<MessageTemplate> = {}): MessageTemplate {
  return {
    id: 'msg-1',
    scope: 'organization',
    organizationId: 'org1',
    category: 'general',
    channel: 'email',
    target: 'external_client',
    name: 'Welcome',
    contentMode: 'rich_builder',
    body: 'Hello',
    templateType: 'welcome',
    variableContext: 'common',
    declaredVariables: [],
    status: 'active',
    version: 1,
    createdAt: '2026-06-21T00:00:00.000Z',
    updatedAt: '2026-06-21T00:00:00.000Z',
    ...overrides,
  };
}

describe('mapWhatsAppToGallery', () => {
  it('maps Meta status to gallery status vocabulary', () => {
    const cases: Array<[WhatsAppTemplateStatus, string]> = [
      ['APPROVED', 'active'],
      ['PENDING', 'draft'],
      ['REJECTED', 'archived'],
      ['PAUSED', 'archived'],
      ['DISABLED', 'archived'],
    ];
    for (const [meta, gallery] of cases) {
      const d = mapWhatsAppToGallery(makeWa({ status: meta }), new Set());
      expect(d.status).toBe(gallery);
      expect(d.waStatus).toBe(meta);
    }
  });

  it('exposes whatsapp channel, body text, and param count', () => {
    const d = mapWhatsAppToGallery(makeWa(), new Set());
    expect(d.channel).toBe('whatsapp');
    expect(d._source).toBe('whatsapp_meta');
    expect(d.body).toBe('Hi {{1}}, your order {{2}} shipped.');
    expect(d.paramCount).toBe(2);
    expect(d.createdAt).toBe('2026-06-20T00:00:00.000Z'); // = syncedAt
  });

  it('flags runtime needs for media-header templates', () => {
    const plain = mapWhatsAppToGallery(makeWa(), new Set());
    expect(plain.hasRuntimeNeeds).toBe(false);

    const media = mapWhatsAppToGallery(
      makeWa({ components: [{ type: 'HEADER', format: 'IMAGE' }, { type: 'BODY', text: 'Hi' }] }),
      new Set(),
    );
    expect(media.hasRuntimeNeeds).toBe(true);
  });

  it('marks isAdopted when the name is in the adopted set', () => {
    expect(mapWhatsAppToGallery(makeWa(), new Set(['order_update'])).isAdopted).toBe(true);
    expect(mapWhatsAppToGallery(makeWa(), new Set(['other'])).isAdopted).toBe(false);
  });

  it('carries the rejected reason through', () => {
    const d = mapWhatsAppToGallery(
      makeWa({ status: 'REJECTED', rejectedReason: 'Invalid sample' }),
      new Set(),
    );
    expect(d.rejectedReason).toBe('Invalid sample');
  });
});

describe('partitionAdopted', () => {
  it('collects adopted whatsapp template names and hides their docs', () => {
    const adoptedDoc = makeMsg({
      id: 'wa-doc',
      channel: 'whatsapp',
      contentMode: 'template',
      whatsappTemplateName: 'order_update',
    });
    const email = makeMsg({ id: 'email-doc' });
    const { adoptedNames, visible } = partitionAdopted([adoptedDoc, email]);

    expect(adoptedNames.has('order_update')).toBe(true);
    expect(visible.map((t) => t.id)).toEqual(['email-doc']); // adopted whatsapp doc hidden
  });

  it('keeps non-whatsapp docs and whatsapp docs without a bound Meta name', () => {
    const orphan = makeMsg({ id: 'orphan', channel: 'whatsapp', contentMode: 'template' });
    const { adoptedNames, visible } = partitionAdopted([orphan]);
    expect(adoptedNames.size).toBe(0);
    expect(visible.map((t) => t.id)).toEqual(['orphan']);
  });
});

describe('mergeGalleryTemplates', () => {
  it('tags firestore docs and sorts merged list by createdAt desc', () => {
    const email = makeMsg({ id: 'email-doc', createdAt: '2026-06-21T00:00:00.000Z' });
    const wa = mapWhatsAppToGallery(makeWa({ syncedAt: '2026-06-22T00:00:00.000Z' }), new Set());

    const merged = mergeGalleryTemplates([email], [wa]);

    expect(merged.map((t) => t.id)).toEqual(['org1_order_update_en_US', 'email-doc']); // newest first
    const firestoreEntry = merged.find((t) => t.id === 'email-doc')!;
    expect(isWhatsAppDisplay(firestoreEntry)).toBe(false);
    expect(firestoreEntry._source).toBe('firestore');
  });
});

describe('toWhatsAppTemplateName', () => {
  it('slugifies an arbitrary name to Meta-valid form', () => {
    expect(toWhatsAppTemplateName('Order Update!')).toBe('order_update');
    expect(toWhatsAppTemplateName('  Welcome — 2026  ')).toBe('welcome_2026');
    expect(toWhatsAppTemplateName('already_ok')).toBe('already_ok');
    expect(toWhatsAppTemplateName('')).toBe('');
    expect(toWhatsAppTemplateName(undefined)).toBe('');
  });
});

describe('isWhatsAppDisplay', () => {
  it('discriminates the union', () => {
    const wa = mapWhatsAppToGallery(makeWa(), new Set());
    const [firestore] = mergeGalleryTemplates([makeMsg()], []);
    expect(isWhatsAppDisplay(wa)).toBe(true);
    expect(isWhatsAppDisplay(firestore)).toBe(false);
  });
});
