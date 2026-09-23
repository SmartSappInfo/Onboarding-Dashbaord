/**
 * {{Org_name}} Experience Platform — Unit Tests for Portal Navigation Resolver
 */

import { describe, it, expect } from 'vitest';
import { resolvePortalPath, getPortalSpaceLinks, normalizePortalRelativePath } from '../portal-navigation';

describe('Portal Navigation Resolver (resolvePortalPath)', () => {
  const slug = 'academy';

  it('maps root preset tokens to canonical portal routes', () => {
    expect(resolvePortalPath('/courses', slug)).toBe('/portal/academy/learn');
    expect(resolvePortalPath('courses', slug)).toBe('/portal/academy/learn');
    expect(resolvePortalPath('/curriculum', slug)).toBe('/portal/academy/learn');
    expect(resolvePortalPath('/resources', slug)).toBe('/portal/academy/content');
    expect(resolvePortalPath('/vault', slug)).toBe('/portal/academy/content');
    expect(resolvePortalPath('/community', slug)).toBe('/portal/academy/community');
    expect(resolvePortalPath('/events', slug)).toBe('/portal/academy/events');
    expect(resolvePortalPath('/get-started', slug)).toBe('/portal/academy/join');
    expect(resolvePortalPath('/join', slug)).toBe('/portal/academy/join');
    expect(resolvePortalPath('/dashboard', slug)).toBe('/portal/academy/dashboard');
  });

  it('correctly maps documentation and articles with query parameters', () => {
    expect(resolvePortalPath('/docs', slug)).toBe('/portal/academy/content?type=doc');
    expect(resolvePortalPath('/articles', slug)).toBe('/portal/academy/content?type=article');
  });

  it('handles already scoped portal paths and rewrites legacy subpaths', () => {
    expect(resolvePortalPath('/portal/academy/courses', slug)).toBe('/portal/academy/learn');
    expect(resolvePortalPath('/portal/academy/resources', slug)).toBe('/portal/academy/content');
    expect(resolvePortalPath('/portal/academy/get-started', slug)).toBe('/portal/academy/join');
    expect(resolvePortalPath('/portal/academy/learn/intro-course', slug)).toBe('/portal/academy/learn/intro-course');
    expect(resolvePortalPath('/portal/academy/courses/finance-101', slug)).toBe('/portal/academy/learn/finance-101');
  });

  it('preserves external links and standard protocols untouched', () => {
    expect(resolvePortalPath('https://smartsapp.com', slug)).toBe('https://smartsapp.com');
    expect(resolvePortalPath('http://example.com/page', slug)).toBe('http://example.com/page');
    expect(resolvePortalPath('mailto:support@smartsapp.com', slug)).toBe('mailto:support@smartsapp.com');
    expect(resolvePortalPath('tel:+233200000000', slug)).toBe('tel:+233200000000');
    expect(resolvePortalPath('#faq', slug)).toBe('#faq');
  });

  it('prevents protocol-relative open redirect attacks', () => {
    expect(resolvePortalPath('//evil.com', slug)).toBe('/portal/academy');
  });

  it('handles empty, null, and root fallback values gracefully', () => {
    expect(resolvePortalPath('', slug)).toBe('/portal/academy');
    expect(resolvePortalPath(null, slug)).toBe('/portal/academy');
    expect(resolvePortalPath(undefined, slug)).toBe('/portal/academy');
    expect(resolvePortalPath('#', slug)).toBe('/portal/academy');
    expect(resolvePortalPath('/', slug)).toBe('/portal/academy');
  });

  it('preserves query strings and anchors on mapped paths', () => {
    expect(resolvePortalPath('/courses?sort=newest', slug)).toBe('/portal/academy/learn?sort=newest');
    expect(resolvePortalPath('/resources?category=finance', slug)).toBe('/portal/academy/content?category=finance');
  });
});

describe('getPortalSpaceLinks', () => {
  it('returns canonical destination map for a given slug', () => {
    const links = getPortalSpaceLinks('bursar-hub');
    expect(links.home).toBe('/portal/bursar-hub');
    expect(links.learn).toBe('/portal/bursar-hub/learn');
    expect(links.content).toBe('/portal/bursar-hub/content');
    expect(links.community).toBe('/portal/bursar-hub/community');
    expect(links.events).toBe('/portal/bursar-hub/events');
    expect(links.join).toBe('/portal/bursar-hub/join');
    expect(links.dashboard).toBe('/portal/bursar-hub/dashboard');
  });
});

describe('normalizePortalRelativePath', () => {
  it('normalizes legacy presets to canonical relative paths', () => {
    expect(normalizePortalRelativePath('/courses')).toBe('/learn');
    expect(normalizePortalRelativePath('courses')).toBe('/learn');
    expect(normalizePortalRelativePath('/resources')).toBe('/content');
    expect(normalizePortalRelativePath('/get-started')).toBe('/join');
    expect(normalizePortalRelativePath('/docs')).toBe('/content?type=doc');
    expect(normalizePortalRelativePath('/articles')).toBe('/content?type=article');
    expect(normalizePortalRelativePath('/community')).toBe('/community');
    expect(normalizePortalRelativePath('/events')).toBe('/events');
    expect(normalizePortalRelativePath('/learn')).toBe('/learn');
    expect(normalizePortalRelativePath('/content')).toBe('/content');
  });

  it('preserves external and anchor links', () => {
    expect(normalizePortalRelativePath('https://example.com')).toBe('https://example.com');
    expect(normalizePortalRelativePath('#faq')).toBe('#faq');
  });
});
