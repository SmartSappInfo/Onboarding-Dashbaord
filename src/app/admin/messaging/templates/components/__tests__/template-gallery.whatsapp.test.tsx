import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TemplateGallery } from '../template-gallery';
import { mapWhatsAppToGallery, mergeGalleryTemplates, type GalleryTemplate } from '../../lib/unified-template';
import type { MessageTemplate } from '@/lib/types';
import type { WhatsAppTemplate } from '@/lib/whatsapp/whatsapp-types';

// localStorage is touched on mount; jsdom provides it, just reset between tests.
beforeEach(() => localStorage.clear());

vi.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
    };
  },
  usePathname() {
    return '/admin/messaging/templates';
  },
  useSearchParams() {
    return {
      get: vi.fn(),
    };
  },
}));

function email(id: string, name: string): MessageTemplate {
  return {
    id,
    scope: 'organization',
    organizationId: 'org1',
    category: 'general',
    channel: 'email',
    target: 'external_client',
    name,
    contentMode: 'rich_builder',
    body: 'email body',
    templateType: 'welcome',
    variableContext: 'common',
    declaredVariables: [],
    status: 'active',
    version: 1,
    createdAt: '2026-06-21T00:00:00.000Z',
    updatedAt: '2026-06-21T00:00:00.000Z',
  };
}

function wa(overrides: Partial<WhatsAppTemplate> = {}): WhatsAppTemplate {
  return {
    id: 'org1_promo_en',
    organizationId: 'org1',
    metaTemplateId: 'm1',
    name: 'promo',
    language: 'en_US',
    category: 'MARKETING',
    status: 'APPROVED',
    components: [{ type: 'BODY', text: 'WhatsApp body here' }],
    paramCount: 0,
    syncedAt: '2026-06-22T00:00:00.000Z',
    ...overrides,
  };
}

function renderGallery(items: GalleryTemplate[], extra = {}) {
  return render(
    <TemplateGallery
      templates={items}
      isLoading={false}
      cloningId={null}
      onEdit={vi.fn()}
      onClone={vi.fn()}
      onDelete={vi.fn()}
      onPreview={vi.fn()}
      onUpdateStatus={vi.fn()}
      onWhatsAppSendTest={vi.fn()}
      onWhatsAppAdopt={vi.fn()}
      {...extra}
    />,
  );
}

describe('TemplateGallery — WhatsApp awareness', () => {
  it('renders a WhatsApp card with its Meta status and no Edit/Delete controls', () => {
    const merged = mergeGalleryTemplates([], [mapWhatsAppToGallery(wa(), new Set())]);
    renderGallery(merged);

    expect(screen.getByText('promo')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
    // Read-only: no edit/clone/delete affordances on a Meta-mirror card.
    expect(screen.queryByTitle('Edit')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Delete')).not.toBeInTheDocument();
    // Channel-specific actions present.
    expect(screen.getByText('Send test')).toBeInTheDocument();
    expect(screen.getByText('Enable for campaigns')).toBeInTheDocument();
  });

  it('shows "Test-send only" and hides adopt for media-header templates', () => {
    const media = wa({ components: [{ type: 'HEADER', format: 'IMAGE' }, { type: 'BODY', text: 'hi' }] });
    renderGallery(mergeGalleryTemplates([], [mapWhatsAppToGallery(media, new Set())]));

    expect(screen.getByText('Test-send only')).toBeInTheDocument();
    expect(screen.queryByText('Enable for campaigns')).not.toBeInTheDocument();
  });

  it('shows "Enabled" (disabled) when already adopted', () => {
    const merged = mergeGalleryTemplates([], [mapWhatsAppToGallery(wa(), new Set(['promo']))]);
    renderGallery(merged);
    expect(screen.getByText('Enabled')).toBeInTheDocument();
    expect(screen.queryByText('Enable for campaigns')).not.toBeInTheDocument();
  });

  it('keeps email and WhatsApp cards together in a flat list', () => {
    const merged = mergeGalleryTemplates([email('e1', 'Welcome')], [mapWhatsAppToGallery(wa(), new Set())]);
    renderGallery(merged);
    expect(screen.getByText('Welcome')).toBeInTheDocument();
    expect(screen.getByText('promo')).toBeInTheDocument();
  });

  it('groups WhatsApp templates under their own channel group', () => {
    localStorage.setItem('smartsapp_template_groupBy', 'channel');
    const merged = mergeGalleryTemplates([email('e1', 'Welcome')], [mapWhatsAppToGallery(wa(), new Set())]);
    renderGallery(merged);
    expect(screen.getByText('WhatsApp Templates')).toBeInTheDocument();
    expect(screen.getByText('Email Templates')).toBeInTheDocument();
  });
});
