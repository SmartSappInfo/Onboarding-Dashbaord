import { describe, it, expect } from 'vitest';
import { validateExternalUrl } from '../ssrf-guard';

describe('SSRF Guard (validateExternalUrl)', () => {
  it('allows valid public HTTP and HTTPS URLs', () => {
    const validUrls = [
      'https://example.com',
      'https://api.github.com/users',
      'http://my-company-domain.com/webhook',
      'https://hooks.zapier.com/hooks/catch/123/abc/',
      'https://subdomain.domain.co.uk/path?query=1#hash',
    ];

    for (const url of validUrls) {
      const res = validateExternalUrl(url);
      expect(res.isValid).toBe(true);
      expect(res.sanitizedUrl).toBeDefined();
      expect(res.error).toBeUndefined();
    }
  });

  it('rejects loopback and localhost addresses', () => {
    const loopbacks = [
      'http://localhost',
      'http://localhost:3000',
      'http://localhost:8080/webhook',
      'http://127.0.0.1',
      'http://127.0.0.1:9002/api/admin',
      'http://127.255.255.255',
      'http://[::1]',
      'http://0.0.0.0',
    ];

    for (const url of loopbacks) {
      const res = validateExternalUrl(url);
      expect(res.isValid).toBe(false);
      expect(res.error).toBeDefined();
    }
  });

  it('rejects cloud instance metadata endpoints', () => {
    const metadataUrls = [
      'http://169.254.169.254/computeMetadata/v1/',
      'http://169.254.169.254/latest/meta-data/',
      'http://metadata.google.internal/computeMetadata/v1/',
      'http://metadata',
      'http://instance-data',
    ];

    for (const url of metadataUrls) {
      const res = validateExternalUrl(url);
      expect(res.isValid).toBe(false);
      expect(res.error).toBeDefined();
    }
  });

  it('rejects RFC 1918 private IPv4 subnets', () => {
    const privateIps = [
      'http://10.0.0.1/admin',
      'http://10.255.255.254',
      'http://172.16.0.1:8000',
      'http://172.31.255.255',
      'http://192.168.1.1',
      'http://192.168.0.100:8080',
    ];

    for (const url of privateIps) {
      const res = validateExternalUrl(url);
      expect(res.isValid).toBe(false);
      expect(res.error).toBeDefined();
    }
  });

  it('rejects non-HTTP protocols (file, gopher, ftp, etc.)', () => {
    const badProtocols = [
      'file:///etc/passwd',
      'ftp://ftp.example.com/file',
      'gopher://gopher.example.com',
      'javascript:alert(1)',
      'data:text/html,<html>',
    ];

    for (const url of badProtocols) {
      const res = validateExternalUrl(url);
      expect(res.isValid).toBe(false);
      expect(res.error).toBeDefined();
    }
  });

  it('rejects embedded credentials', () => {
    const urlWithAuth = 'http://admin:password@example.com/api';
    const res = validateExternalUrl(urlWithAuth);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('embedded authentication credentials');
  });

  it('rejects dangerous infrastructure ports', () => {
    const dangerousPorts = [
      'http://example.com:22',
      'http://example.com:25',
      'http://example.com:2375',
      'http://example.com:5432',
      'http://example.com:6379',
    ];

    for (const url of dangerousPorts) {
      const res = validateExternalUrl(url);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('restricted');
    }
  });
});
