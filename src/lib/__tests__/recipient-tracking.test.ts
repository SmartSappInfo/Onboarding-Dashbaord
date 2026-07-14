import { describe, it, expect, vi } from 'vitest';

vi.mock('../utils/url-helpers', () => ({
  getBaseUrl: () => 'https://go.smartsapp.com',
}));

import { encryptToken, decryptToken } from '../crypto';
import { renderBlocksToHtml } from '../messaging-utils';

describe('Link Picker & Encrypted Tracking Tests', () => {
  it('should encrypt and decrypt contact ID correctly', () => {
    const contactId = 'contact-test-123';
    const token = encryptToken(contactId);
    expect(token).toContain(':');
    
    const parts = token.split(':');
    expect(parts.length).toBe(3); // iv, authTag, ciphertext

    const decrypted = decryptToken(token);
    expect(decrypted).toBe(contactId);
  });

  it('should translate relative block links to absolute URLs', () => {
    const blocks = [
      {
        id: 'btn-1',
        type: 'button' as const,
        title: 'Click me',
        link: '/p/test-page',
      },
    ];

    const compiledHtml = renderBlocksToHtml(blocks, {}, {
      style: {
        id: 'style-1',
        name: 'Standard style',
        htmlWrapperInternal: '<div>{{body}}</div>',
        htmlWrapperExternal: '<div>{{body}}</div>',
        workspaceIds: ['ws-1'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    expect(compiledHtml).toContain('https://go.smartsapp.com/p/test-page');
  });

  it('should ignore external links when resolving base URL', () => {
    const blocks = [
      {
        id: 'btn-2',
        type: 'button' as const,
        title: 'Google',
        link: 'https://google.com',
      },
    ];

    const compiledHtml = renderBlocksToHtml(blocks, {}, {
      style: {
        id: 'style-1',
        name: 'Standard style',
        htmlWrapperInternal: '<div>{{body}}</div>',
        htmlWrapperExternal: '<div>{{body}}</div>',
        workspaceIds: ['ws-1'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    expect(compiledHtml).toContain('href="https://google.com"');
    expect(compiledHtml).not.toContain('https://go.smartsapp.comhttps://google.com');
  });

  it('should support composite tracking tokens and format them as contactId:entityId', () => {
    const contactId = 'ec_test123';
    const entityId = 'entity_test456';
    const token = encryptToken(`${contactId}:${entityId}`);
    
    const decrypted = decryptToken(token);
    expect(decrypted).toBe(`${contactId}:${entityId}`);
    
    const [decryptedContactId, decryptedEntityId] = decrypted.split(':');
    expect(decryptedContactId).toBe(contactId);
    expect(decryptedEntityId).toBe(entityId);
  });
});
