import { describe, it, expect } from 'vitest';
import { resolveMessagePreviewSnippet } from '../preview-utils';

describe('resolveMessagePreviewSnippet', () => {
  describe('Email Channel', () => {
    it('uses the subject when present', () => {
      const result = resolveMessagePreviewSnippet({
        channel: 'email',
        title: 'End of Term Assessment Report',
        subject: 'Your childs report card',
        body: '<!DOCTYPE html><html><head><title>Email</title></head><body><h1>Report</h1></body></html>',
      });
      expect(result).toBe('Your childs report card');
    });

    it('falls back to title when subject is absent', () => {
      const result = resolveMessagePreviewSnippet({
        channel: 'email',
        title: 'End of Term Assessment Report',
        subject: '',
        body: '<!DOCTYPE html><html><head><title>Email</title></head><body><h1>Report</h1></body></html>',
      });
      expect(result).toBe('End of Term Assessment Report');
    });

    it('cleans any HTML markup inside email subject or title', () => {
      const result = resolveMessagePreviewSnippet({
        channel: 'email',
        subject: '<b>Important:</b> School Reopening Date',
        body: '<p>Some body</p>',
      });
      expect(result).toBe('Important: School Reopening Date');
    });

    it('falls back to previewText when title and subject are absent', () => {
      const result = resolveMessagePreviewSnippet({
        channel: 'email',
        title: null,
        subject: null,
        previewText: 'Click here to review your statement',
        body: '<div>Content</div>',
      });
      expect(result).toBe('Click here to review your statement');
    });

    it('strips full HTML document if only body is provided', () => {
      const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>body { color: #000; font-family: sans-serif; }</style>
</head>
<body>
  <h1>Payment Confirmation</h1>
  <p>Thank you for your payment of GHS 500.</p>
</body>
</html>`;

      const result = resolveMessagePreviewSnippet({
        channel: 'email',
        title: null,
        subject: null,
        body: htmlBody,
      });

      expect(result).not.toContain('<!DOCTYPE');
      expect(result).not.toContain('<html');
      expect(result).not.toContain('<head');
      expect(result).not.toContain('style');
      expect(result).toBe('Payment Confirmation Thank you for your payment of GHS 500.');
    });

    it('returns default fallback for empty email', () => {
      const result = resolveMessagePreviewSnippet({
        channel: 'email',
        title: '',
        subject: '',
        body: '',
      });
      expect(result).toBe('Email message');
    });
  });

  describe('SMS Channel', () => {
    it('uses the body text for SMS', () => {
      const result = resolveMessagePreviewSnippet({
        channel: 'sms',
        title: 'SMS Campaign 1',
        body: 'SmartSapp upgrade completed successfully. All services operational.',
      });
      expect(result).toBe('SmartSapp upgrade completed successfully. All services operational.');
    });

    it('strips any inadvertent HTML in SMS body', () => {
      const result = resolveMessagePreviewSnippet({
        channel: 'sms',
        body: 'Your code is <b>123456</b>. Do not share.',
      });
      expect(result).toBe('Your code is 123456. Do not share.');
    });

    it('falls back to title if body is empty', () => {
      const result = resolveMessagePreviewSnippet({
        channel: 'sms',
        title: 'Emergency Alert',
        body: '',
      });
      expect(result).toBe('Emergency Alert');
    });

    it('returns fallback when both body and title are empty', () => {
      const result = resolveMessagePreviewSnippet({
        channel: 'sms',
        title: '',
        body: '',
      });
      expect(result).toBe('No message content');
    });
  });

  describe('WhatsApp Channel', () => {
    it('uses the body text for WhatsApp', () => {
      const result = resolveMessagePreviewSnippet({
        channel: 'whatsapp',
        title: 'WA Reminder',
        body: 'Hello John, your appointment is set for 2 PM tomorrow.',
      });
      expect(result).toBe('Hello John, your appointment is set for 2 PM tomorrow.');
    });

    it('strips HTML and entities cleanly in WhatsApp body', () => {
      const result = resolveMessagePreviewSnippet({
        channel: 'whatsapp',
        body: 'Reminder &amp; Notice: Class begins at &lt;8:00 AM&gt; tomorrow.',
      });
      expect(result).toBe('Reminder & Notice: Class begins at tomorrow.');
    });
  });

  describe('Truncation and Length Guard', () => {
    it('truncates to maxLength cleanly', () => {
      const longText = 'A'.repeat(200);
      const result = resolveMessagePreviewSnippet({
        channel: 'sms',
        body: longText,
        maxLength: 50,
      });
      expect(result.length).toBe(50);
    });
  });
});
