import { describe, it, expect } from 'vitest';
import {
  mapHotspotTypeToLayerType,
  mapLayerTypeToHotspotType,
  mapHotspotToLayer,
  mapLayerToHotspot,
  flipbookToDocumentAggregate,
  documentAggregateToFlipbook,
  flipbookPageToDocumentPage,
  documentPageToFlipbookPage,
} from '../document-adapter';
import type { FlipbookConfig, FlipbookPage, FlipbookHotspot } from '@/lib/types/flipbook-types';

describe('Document Adapter Protocol', () => {
  it('maps hotspot types to layer types and back idempotently', () => {
    expect(mapHotspotTypeToLayerType('video')).toBe('video');
    expect(mapHotspotTypeToLayerType('link')).toBe('link');
    expect(mapHotspotTypeToLayerType('web')).toBe('embed');

    expect(mapLayerTypeToHotspotType('video')).toBe('video');
    expect(mapLayerTypeToHotspotType('link')).toBe('link');
    expect(mapLayerTypeToHotspotType('embed')).toBe('web');
  });

  it('converts FlipbookHotspot to DocumentLayer and back without loss', () => {
    const hotspot: FlipbookHotspot = {
      id: 'hs_1',
      pageNumber: 2,
      x: 10,
      y: 20,
      width: 30,
      height: 40,
      type: 'video',
      title: 'School Tour',
      targetUrl: 'https://youtube.com/watch?v=123',
      autoPlay: true,
      icon: 'video',
    };

    const layer = mapHotspotToLayer(hotspot, 'doc_1', 'v_1');
    expect(layer.id).toBe('hs_1');
    expect(layer.type).toBe('video');
    expect(layer.pageNumber).toBe(2);
    expect(layer.behavior?.autoPlay).toBe(true);

    const roundTrip = mapLayerToHotspot(layer);
    expect(roundTrip.id).toBe(hotspot.id);
    expect(roundTrip.type).toBe(hotspot.type);
    expect(roundTrip.targetUrl).toBe(hotspot.targetUrl);
    expect(roundTrip.autoPlay).toBe(true);
  });

  it('converts FlipbookPage to DocumentPage and back', () => {
    const page: FlipbookPage = {
      id: 'doc_1_page_1',
      flipbookId: 'doc_1',
      pageNumber: 1,
      imageUrl: 'https://storage.googleapis.com/test.jpg',
      thumbnailUrl: 'https://storage.googleapis.com/test_thumb.jpg',
      width: 800,
      height: 1130,
      extractedText: 'Welcome to our school prospectus',
    };

    const docPage = flipbookPageToDocumentPage(page, 'v_1', 'ws_1');
    expect(docPage.id).toBe(page.id);
    expect(docPage.documentId).toBe('doc_1');
    expect(docPage.renderedAssetUrl).toBe(page.imageUrl);
    expect(docPage.extractedText).toBe(page.extractedText);
    expect(docPage.textStatus).toBe('extracted');

    const roundTripPage = documentPageToFlipbookPage(docPage);
    expect(roundTripPage.id).toBe(page.id);
    expect(roundTripPage.flipbookId).toBe(page.flipbookId);
    expect(roundTripPage.imageUrl).toBe(page.imageUrl);
    expect(roundTripPage.extractedText).toBe(page.extractedText);
  });

  it('converts full FlipbookConfig into Document entities and reconstructs seamlessly', () => {
    const flipbook: FlipbookConfig = {
      id: 'fb_100',
      workspaceId: 'ws_abc',
      title: 'Annual Report 2026',
      description: 'Comprehensive annual overview',
      slug: 'annual-report-2026',
      status: 'published',
      sourceFileUrl: 'https://storage.googleapis.com/report.pdf',
      sourceFileType: 'pdf',
      sourceFileName: 'report.pdf',
      pageCount: 24,
      aspectRatio: 1.414,
      style: {
        pageStyle: 'magazine',
        soundEnabled: true,
        hardcover: true,
        backgroundColor: '#0f172a',
        enableDownloadPdf: true,
        enablePrint: true,
        enableShare: true,
        enableSearch: true,
        enableThumbnails: true,
      },
      hotspots: [
        {
          id: 'h_1',
          pageNumber: 1,
          x: 5,
          y: 5,
          width: 20,
          height: 10,
          type: 'link',
          title: 'Visit Website',
          targetUrl: 'https://example.com',
        },
      ],
      leadGate: {
        enabled: true,
        triggerPage: 3,
        title: 'Unlock Full Report',
        description: 'Provide your work email',
        requireName: true,
        requireEmail: true,
        requirePhone: false,
        ctaText: 'Access Report',
        tagToApply: 'lead-report-2026',
      },
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-02T00:00:00.000Z',
      createdBy: 'user_123',
      viewsCount: 150,
      leadsCount: 12,
      flipsCount: 420,
      likesCount: 18,
    };

    const aggregate = flipbookToDocumentAggregate(flipbook);
    expect(aggregate.document.id).toBe(flipbook.id);
    expect(aggregate.document.title).toBe(flipbook.title);
    expect(aggregate.document.status).toBe('published');
    expect(aggregate.version.pageCount).toBe(24);
    expect(aggregate.experience.layout.hardcover).toBe(true);
    expect(aggregate.experience.leadGate?.enabled).toBe(true);
    expect(aggregate.layers.length).toBe(1);

    const reconstructed = documentAggregateToFlipbook(
      aggregate.document,
      aggregate.source,
      aggregate.experience,
      aggregate.layers,
      aggregate.accessPolicy,
      aggregate.version.pageCount
    );

    expect(reconstructed.id).toBe(flipbook.id);
    expect(reconstructed.title).toBe(flipbook.title);
    expect(reconstructed.slug).toBe(flipbook.slug);
    expect(reconstructed.status).toBe(flipbook.status);
    expect(reconstructed.pageCount).toBe(flipbook.pageCount);
    expect(reconstructed.style.hardcover).toBe(true);
    expect(reconstructed.leadGate.enabled).toBe(true);
    expect(reconstructed.hotspots.length).toBe(1);
    expect(reconstructed.hotspots[0].targetUrl).toBe('https://example.com');
  });
});

describe('Document Signing Compatibility Adapter (P2.2)', () => {
  it('converts legacy Contract with PDFForm into a valid SigningEnvelope', async () => {
    const { legacyContractToEnvelope } = await import('../document-adapter');
    const mockContract = {
      id: 'contract_123',
      entityId: 'ent_456',
      entityName: 'Acme Corp',
      pdfId: 'pdf_789',
      pdfName: 'Master Services Agreement',
      status: 'signed' as const,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-02T12:00:00.000Z',
      signedAt: '2026-09-02T12:00:00.000Z',
      dealId: 'deal_999',
      storagePath: 'contracts/acme_signed.pdf',
      documentDigest: 'sha256_mock_hash_123',
      recipients: [
        {
          name: 'Alice Smith',
          email: 'alice@acme.com',
          phone: '+1234567890',
          type: 'signer',
        },
      ],
    };

    const mockPdfForm = {
      id: 'pdf_789',
      workspaceIds: ['ws_enterprise_1'],
      name: 'Master Services Agreement',
      publicTitle: 'MSA 2026',
      slug: 'msa-2026',
      storagePath: 'templates/msa.pdf',
      downloadUrl: 'https://storage.googleapis.com/templates/msa.pdf',
      status: 'published' as const,
      fields: [],
    };

    const envelope = legacyContractToEnvelope(mockContract, mockPdfForm);

    expect(envelope.id).toBe('contract_123');
    expect(envelope.workspaceId).toBe('ws_enterprise_1');
    expect(envelope.title).toBe('Master Services Agreement');
    expect(envelope.status).toBe('completed');
    expect(envelope.contractId).toBe('contract_123');
    expect(envelope.dealId).toBe('deal_999');
    expect(envelope.isLegacyMigrated).toBe(true);
    expect(envelope.recipients).toHaveLength(1);
    expect(envelope.recipients[0].name).toBe('Alice Smith');
    expect(envelope.recipients[0].email).toBe('alice@acme.com');
    expect(envelope.recipients[0].status).toBe('signed');
    expect(envelope.recipients[0].signedAt).toBe('2026-09-02T12:00:00.000Z');
  });

  it('synthesizes virtual recipient when legacy Contract has empty recipients array', async () => {
    const { legacyContractToEnvelope } = await import('../document-adapter');
    const mockContract = {
      id: 'contract_legacy_no_recipients',
      entityId: 'ent_777',
      entityName: 'Beta LLC',
      pdfId: 'pdf_111',
      pdfName: 'Vendor Agreement',
      status: 'sent' as const,
      createdAt: '2026-09-10T00:00:00.000Z',
      updatedAt: '2026-09-10T00:00:00.000Z',
      recipients: [],
    };

    const envelope = legacyContractToEnvelope(mockContract);

    expect(envelope.recipients).toHaveLength(1);
    expect(envelope.recipients[0].name).toBe('Beta LLC');
    expect(envelope.recipients[0].email).toBe('recipient@placeholder.internal');
    expect(envelope.recipients[0].role).toBe('signer');
    expect(envelope.recipients[0].status).toBe('invited');
  });

  it('projects modern SigningEnvelope back to legacy Contract format without data loss', async () => {
    const { envelopeToLegacyContract } = await import('../document-adapter');
    const { SigningEnvelopeSchema } = await import('@/lib/types/document-signing');

    const envelope = SigningEnvelopeSchema.parse({
      id: 'env_roundtrip',
      workspaceId: 'ws_demo',
      title: 'Enterprise Partnership',
      status: 'completed',
      contractId: 'orig_contract_id',
      dealId: 'deal_alpha',
      entityId: 'ent_alpha',
      routingMode: 'sequential',
      currentRoutingOrder: 1,
      documentStoragePath: 'agreements/doc.pdf',
      completedDocumentStoragePath: 'agreements/doc_sealed.pdf',
      preExecutionSha256: 'sha256_pre',
      completedSha256: 'sha256_sealed',
      completedAt: '2026-09-29T12:00:00.000Z',
      expiresAt: '2026-10-29T12:00:00.000Z',
      createdBy: 'usr_lead',
      createdAt: '2026-09-29T00:00:00.000Z',
      updatedAt: '2026-09-29T12:00:00.000Z',
      recipients: [
        {
          id: 'rec_sign_1',
          workspaceId: 'ws_demo',
          envelopeId: 'env_roundtrip',
          entityId: 'ent_alpha',
          role: 'signer',
          name: 'Jane Doe',
          email: 'jane@alpha.com',
          routingOrder: 1,
          status: 'signed',
          tokenHash: 'h_token',
          tokenExpiresAt: '2026-10-29T12:00:00.000Z',
          signedAt: '2026-09-29T12:00:00.000Z',
        },
      ],
    });

    const legacyContract = envelopeToLegacyContract(envelope);

    expect(legacyContract.id).toBe('orig_contract_id');
    expect(legacyContract.entityId).toBe('ent_alpha');
    expect(legacyContract.entityName).toBe('Jane Doe');
    expect(legacyContract.status).toBe('signed');
    expect(legacyContract.dealId).toBe('deal_alpha');
    expect(legacyContract.storagePath).toBe('agreements/doc_sealed.pdf');
    expect(legacyContract.documentDigest).toBe('sha256_sealed');
    expect(legacyContract.recipients).toHaveLength(1);
    expect(legacyContract.recipients[0].name).toBe('Jane Doe');
    expect(legacyContract.recipients[0].email).toBe('jane@alpha.com');
  });
});

