import { describe, it, expect, vi } from 'vitest';
import { assertNoHtmlInSms } from '../mnotify-service';

describe('Channel Rigid Invariants: assertNoHtmlInSms', () => {
  it('allows clean plain-text SMS messages and URLs', () => {
    expect(() => {
      assertNoHtmlInSms('How We Stopped Over 60 Schools from Losing Students to Competitors. Go here to learn more: https://go.smartsapp.com/m/stop-losing');
    }).not.toThrow();

    expect(() => {
      assertNoHtmlInSms('Hi Kwame, your child was marked present today at 08:05 AM. Contact info@school.com for details.');
    }).not.toThrow();
  });

  it('rejects SMS messages containing DOCTYPE or html tags', () => {
    expect(() => {
      assertNoHtmlInSms('<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body>Hello</body></html>');
    }).toThrow(/Cannot send SMS: Message contains HTML markup/);
  });

  it('rejects SMS messages containing table markup', () => {
    expect(() => {
      assertNoHtmlInSms('<table width="100%"><tr><td>How We Stopped Over 60 Schools</td></tr></table>');
    }).toThrow(/Cannot send SMS: Message contains HTML markup/);
  });

  it('rejects SMS messages containing org footer sentinel', () => {
    expect(() => {
      assertNoHtmlInSms('Hello world\n<!-- org-footer-sentinel -->\nSmartSapp Accra');
    }).toThrow(/Cannot send SMS: Message contains HTML markup/);
  });

  it('rejects SMS messages containing script or style tags', () => {
    expect(() => {
      assertNoHtmlInSms('<style>body { font-family: Figtree; }</style> Hello');
    }).toThrow(/Cannot send SMS: Message contains HTML markup/);

    expect(() => {
      assertNoHtmlInSms('<script>alert("xss")</script> Hello');
    }).toThrow(/Cannot send SMS: Message contains HTML markup/);
  });
});
