import { describe, it, expect } from 'vitest';
import { DOMScraperService } from '../scraper/DOMScraperService';

describe('DOMScraperService', () => {
  it('correctly parses title, meta description, and open graph tags', () => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Kumasi International Academy | Excellence in Education</title>
          <meta name="description" content="Leading private international school in Kumasi, Ashanti Region.">
          <meta property="og:title" content="Kumasi International Academy">
          <meta property="og:image" content="https://kumasiact.edu.gh/logo.png">
        </head>
        <body>
          <a href="https://facebook.com/kumasiact">Facebook</a>
          <a href="https://linkedin.com/company/kumasi-academy">LinkedIn</a>
          <a href="mailto:admissions@kumasiact.edu.gh">Email Admissions</a>
          <script src="https://js.paystack.co/v1/inline.js"></script>
        </body>
      </html>
    `;

    const parsed = DOMScraperService.parseHtmlMarkup(mockHtml, 'kumasiact.edu.gh');

    expect(parsed.title).toBe('Kumasi International Academy | Excellence in Education');
    expect(parsed.metaDescription).toBe('Leading private international school in Kumasi, Ashanti Region.');
    expect(parsed.ogTitle).toBe('Kumasi International Academy');
    expect(parsed.ogImage).toBe('https://kumasiact.edu.gh/logo.png');
    expect(parsed.socialLinks.facebook).toContain('facebook.com/kumasiact');
    expect(parsed.socialLinks.linkedin).toContain('linkedin.com/company/kumasi-academy');
    expect(parsed.detectedEmails).toContain('admissions@kumasiact.edu.gh');
    expect(parsed.hasOnlinePayment).toBe(true);
    expect(parsed.paymentSignatures.some(s => s.provider === 'paystack')).toBe(true);
  });

  it('detects multiple e-commerce payment signatures (Flutterwave, WooCommerce, Shopify, MoMo)', () => {
    const mockHtml = `
      <html>
        <body class="woocommerce-cart">
          <div>Pay with MTN Mobile Money or card</div>
          <script src="https://checkout.flutterwave.com/v3.js"></script>
        </body>
      </html>
    `;

    const parsed = DOMScraperService.parseHtmlMarkup(mockHtml, 'store.gh');

    expect(parsed.hasOnlinePayment).toBe(true);
    expect(parsed.paymentSignatures.some(s => s.provider === 'flutterwave')).toBe(true);
    expect(parsed.paymentSignatures.some(s => s.provider === 'woocommerce')).toBe(true);
    expect(parsed.paymentSignatures.some(s => s.provider === 'mtn_momo')).toBe(true);
  });

  it('sanitizes script tags and harmful entities from meta tags', () => {
    const maliciousHtml = `
      <html>
        <head>
          <title><script>alert("xss")</script>Secure Institute &amp; Academy</title>
          <meta name="description" content="Safe description &quot;quoted&quot;">
        </head>
      </html>
    `;

    const parsed = DOMScraperService.parseHtmlMarkup(maliciousHtml, 'secure.edu');
    expect(parsed.title).toBe('alert("xss")Secure Institute & Academy');
    expect(parsed.title).not.toContain('<script>');
    expect(parsed.metaDescription).toBe('Safe description "quoted"');
  });
});
