import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildDistributionUrl,
  updateFormSlugAction,
  createDistributionLinkAction,
  getFormDistributionsAction,
  deleteDistributionLinkAction,
  generateEmbedSnippet,
} from '../form-distribution-actions';

// Mock firebase-admin
vi.mock('@/lib/firebase-admin', () => {
  const updateMock = vi.fn().mockResolvedValue({});
  const deleteMock = vi.fn().mockResolvedValue({});
  const addMock = vi.fn().mockResolvedValue({ id: 'dist_link_123' });

  const docMock = vi.fn((docId: string) => ({
    get: vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({
        id: docId,
        formId: 'form_123',
        workspaceId: 'ws_abc',
        slug: 'admissions-2026',
        title: 'Admissions 2026',
      }),
    }),
    update: updateMock,
    delete: deleteMock,
  }));

  const collectionMock = vi.fn((colName: string) => ({
    doc: docMock,
    add: addMock,
    where: vi.fn((field: string, _op: string, val: string) => ({
      get: vi.fn().mockResolvedValue({
        docs: val === 'existing-conflict-slug' 
          ? [{ id: 'other_form_999', data: () => ({ slug: val }) }]
          : field === 'formId'
          ? [{ id: 'dist_1', data: () => ({ name: 'Facebook Ad', channel: 'hosted_link', formId: 'form_123' }) }]
          : [],
      }),
    })),
  }));

  return {
    adminDb: {
      collection: collectionMock,
    },
  };
});

describe('SmartSapp Forms 2.0: Distribution Hub & Public Embeds Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildDistributionUrl', () => {
    it('constructs canonical URL with proper base and slug', () => {
      const url = buildDistributionUrl('https://app.smartsapp.com/', 'intake-form');
      expect(url).toBe('https://app.smartsapp.com/p/f/intake-form');
    });

    it('encodes and appends all UTM parameters correctly', () => {
      const url = buildDistributionUrl('https://app.smartsapp.com', 'intake-form', {
        source: 'newsletter',
        medium: 'email',
        campaign: 'fall intake 2026',
        term: 'primary school',
        content: 'hero_cta',
      });

      expect(url).toContain('https://app.smartsapp.com/p/f/intake-form?');
      expect(url).toContain('utm_source=newsletter');
      expect(url).toContain('utm_medium=email');
      expect(url).toContain('utm_campaign=fall+intake+2026');
      expect(url).toContain('utm_term=primary+school');
      expect(url).toContain('utm_content=hero_cta');
    });
  });

  describe('updateFormSlugAction', () => {
    it('validates empty inputs', async () => {
      const res = await updateFormSlugAction('', '');
      expect(res.success).toBe(false);
    });

    it('rejects invalid slug formats', async () => {
      const res = await updateFormSlugAction('form_123', 'invalid slug with spaces!');
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });

    it('detects slug collisions with other forms', async () => {
      const res = await updateFormSlugAction('form_123', 'existing-conflict-slug');
      expect(res.success).toBe(false);
      expect(res.error).toContain('already taken');
    });

    it('successfully sanitizes and updates valid slug', async () => {
      const res = await updateFormSlugAction('form_123', 'fall-admissions-2026');
      expect(res.success).toBe(true);
      expect(res.slug).toBe('fall-admissions-2026');
    });
  });

  describe('Distribution Links Management', () => {
    it('creates a trackable campaign link document', async () => {
      const res = await createDistributionLinkAction({
        formId: 'form_123',
        workspaceId: 'ws_abc',
        name: 'LinkedIn Lead Gen Campaign',
        channel: 'hosted_link',
        utmSource: 'linkedin',
        utmMedium: 'social',
        utmCampaign: 'lead_gen_q3',
      });

      expect(res.success).toBe(true);
      expect(res.link?.id).toBe('dist_link_123');
      expect(res.link?.generatedUrl).toContain('utm_source=linkedin');
    });

    it('retrieves saved distribution links for a form', async () => {
      const res = await getFormDistributionsAction('form_123');
      expect(res.success).toBe(true);
      expect(res.links.length).toBe(1);
    });

    it('deletes a distribution link document', async () => {
      const res = await deleteDistributionLinkAction('dist_123');
      expect(res.success).toBe(true);
    });
  });

  describe('generateEmbedSnippet', () => {
    it('generates responsive inline iframe with auto-resize postMessage listener', () => {
      const code = generateEmbedSnippet('admissions-form', {
        embedType: 'inline',
        width: '100%',
        height: '650px',
        autoResize: true,
      }, 'https://app.smartsapp.com');

      expect(code).toContain('<iframe');
      expect(code).toContain('id="smartsapp-form-admissions-form"');
      expect(code).toContain('src="https://app.smartsapp.com/p/f/admissions-form?embed=true"');
      expect(code).toContain('smartSappFormResize');
    });

    it('generates modal popup widget snippet', () => {
      const code = generateEmbedSnippet('contact-form', {
        embedType: 'popup',
        width: '100%',
        height: '650px',
        autoResize: true,
        triggerText: 'Get in Touch',
        triggerColor: '#10b981',
      }, 'https://app.smartsapp.com');

      expect(code).toContain('Get in Touch');
      expect(code).toContain('background-color: #10b981');
      expect(code).toContain('smartsapp-popup-modal-contact-form');
    });

    it('generates slide-over drawer widget snippet', () => {
      const code = generateEmbedSnippet('feedback-form', {
        embedType: 'slideover',
        width: '100%',
        height: '650px',
        autoResize: true,
        triggerText: 'Feedback',
      }, 'https://app.smartsapp.com');

      expect(code).toContain('Feedback');
      expect(code).toContain('smartsapp-drawer-feedback-form');
    });
  });
});
