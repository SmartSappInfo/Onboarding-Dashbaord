import { describe, it, expect } from 'vitest';
import {
  createSignedDistributionToken,
  verifySignedDistributionToken,
  generateDistributionQRCode,
  generateEmbedIframeSnippet,
} from '../distribution-service';

describe('Distribution Service (Phase 7)', () => {
  const samplePayload = {
    workspaceId: 'ws_test',
    documentId: 'doc_123',
    versionId: 'ver_1',
    distributionId: 'dist_999',
    type: 'campaign' as const,
    campaignId: 'spring-admissions-2026',
    contactId: 'contact_456',
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), // +24 hours
  };

  it('signs and successfully verifies a distribution token', () => {
    const token = createSignedDistributionToken(samplePayload);
    expect(token).toBeDefined();
    expect(token).toContain('.');

    const res = verifySignedDistributionToken(token);
    expect(res.valid).toBe(true);
    expect(res.payload?.documentId).toBe('doc_123');
    expect(res.payload?.campaignId).toBe('spring-admissions-2026');
    expect(res.payload?.contactId).toBe('contact_456');
  });

  it('rejects a tampered distribution token', () => {
    const token = createSignedDistributionToken(samplePayload);
    const [data, sig] = token.split('.');
    const tamperedToken = `${data}TAMPERED.${sig}`;

    const res = verifySignedDistributionToken(tamperedToken);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/Invalid signature|Token has been tampered/i);
  });

  it('identifies an expired distribution token', () => {
    const expiredPayload = {
      ...samplePayload,
      expiresAt: new Date(Date.now() - 1000 * 60).toISOString(), // -1 minute ago
    };

    const token = createSignedDistributionToken(expiredPayload);
    const res = verifySignedDistributionToken(token);
    expect(res.valid).toBe(false);
    expect(res.expired).toBe(true);
    expect(res.error).toMatch(/expired/i);
  });

  it('generates high-resolution QR code PNG data URL', async () => {
    const qrUrl = 'https://smartsapp.com/d/prospectus-2026';
    const qrDataUrl = await generateDistributionQRCode(qrUrl);
    expect(qrDataUrl).toBeDefined();
    expect(qrDataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('generates responsive embed iframe snippet', () => {
    const snippet = generateEmbedIframeSnippet({
      url: 'https://smartsapp.com/d/prospectus-2026?embed=true',
      title: '2026 Prospectus',
      height: '700px',
    });

    expect(snippet).toContain('<iframe');
    expect(snippet).toContain('src="https://smartsapp.com/d/prospectus-2026?embed=true"');
    expect(snippet).toContain('height="700px"');
    expect(snippet).toContain('allow="fullscreen; autoplay"');
  });
});
