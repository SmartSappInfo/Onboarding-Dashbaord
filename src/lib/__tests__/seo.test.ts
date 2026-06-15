import { describe, it, expect } from 'vitest';
import { resolveSeoMetadata, mapLegacySurveySeo, surveyToSeoFormFields, migrateSurveyFormSeo } from '../seo';
import type { OrgBranding, SeoConfig } from '../types';

const org: OrgBranding = {
  logoUrl: 'https://cdn.example.com/logo.png',
  brandPrimaryColor: '#000',
  brandSecondaryColor: '#111',
  brandFontFamily: 'Inter',
  name: 'Acme Org',
};

const baseFallback = {
  title: 'Content Title',
  description: 'Content description',
  assetImageUrl: 'https://cdn.example.com/banner.png',
};

describe('resolveSeoMetadata — title', () => {
  it('returns a bare title in brand mode (root template appends the brand)', () => {
    const meta = resolveSeoMetadata({ fallback: baseFallback, org });
    expect(meta.title).toBe('Content Title');
  });

  it('prefers the SEO override over the fallback', () => {
    const seo: SeoConfig = { title: 'Override Title' };
    const meta = resolveSeoMetadata({ seo, fallback: baseFallback, org });
    expect(meta.title).toBe('Override Title');
  });

  it('ignores the override when useContentFallback is true', () => {
    const seo: SeoConfig = { title: 'Override Title', useContentFallback: true };
    const meta = resolveSeoMetadata({ seo, fallback: baseFallback, org });
    expect(meta.title).toBe('Content Title');
  });

  it('emits an absolute title (no template branding) with optional suffix', () => {
    const meta = resolveSeoMetadata({
      fallback: { title: 'Survey Unavailable' },
      org,
      title: { mode: 'absolute', suffix: ' — SmartSapp' },
    });
    expect(meta.title).toEqual({ absolute: 'Survey Unavailable — SmartSapp' });
  });

  it('falls back to an empty string when no title is available', () => {
    const meta = resolveSeoMetadata({ fallback: { title: '' }, org });
    expect(meta.title).toBe('');
  });
});

describe('resolveSeoMetadata — description', () => {
  it('strips HTML from the description', () => {
    const seo: SeoConfig = { description: '<p>Hello <b>world</b></p>' };
    const meta = resolveSeoMetadata({ seo, fallback: baseFallback, org });
    expect(meta.description).toBe('Hello world');
  });

  it('uses the fallback description when no override exists', () => {
    const meta = resolveSeoMetadata({ fallback: baseFallback, org });
    expect(meta.description).toBe('Content description');
  });

  it('returns undefined when there is no description anywhere', () => {
    const meta = resolveSeoMetadata({ fallback: { title: 'T' }, org });
    expect(meta.description).toBeUndefined();
  });
});

describe('resolveSeoMetadata — keywords', () => {
  it('splits, trims and de-duplicates a comma string', () => {
    const seo: SeoConfig = { keywords: 'a, b ,a,  c ' };
    const meta = resolveSeoMetadata({ seo, fallback: baseFallback, org });
    expect(meta.keywords).toEqual(['a', 'b', 'c']);
  });

  it('returns undefined for an empty keyword string', () => {
    const seo: SeoConfig = { keywords: '   ,  ' };
    const meta = resolveSeoMetadata({ seo, fallback: baseFallback, org });
    expect(meta.keywords).toBeUndefined();
  });
});

describe('resolveSeoMetadata — OG image modes', () => {
  it('custom mode uses the explicit URL', () => {
    const seo: SeoConfig = { ogImageMode: 'custom', ogImageUrl: 'https://x/c.png' };
    const meta = resolveSeoMetadata({ seo, fallback: baseFallback, org });
    expect(meta.openGraph?.images).toEqual([{ url: 'https://x/c.png' }]);
  });

  it('custom mode with empty URL degrades to the asset image', () => {
    const seo: SeoConfig = { ogImageMode: 'custom', ogImageUrl: '' };
    const meta = resolveSeoMetadata({ seo, fallback: baseFallback, org });
    expect(meta.openGraph?.images).toEqual([{ url: baseFallback.assetImageUrl }]);
  });

  it('entity_logo mode uses the org logo', () => {
    const seo: SeoConfig = { ogImageMode: 'entity_logo' };
    const meta = resolveSeoMetadata({ seo, fallback: baseFallback, org });
    expect(meta.openGraph?.images).toEqual([{ url: org.logoUrl }]);
  });

  it('asset mode (and default) uses the content asset image', () => {
    const meta = resolveSeoMetadata({ seo: { ogImageMode: 'asset' }, fallback: baseFallback, org });
    expect(meta.openGraph?.images).toEqual([{ url: baseFallback.assetImageUrl }]);
  });

  it('falls back to parent images when nothing else resolves', () => {
    const parentImages = [{ url: 'https://x/parent.png' }];
    const meta = resolveSeoMetadata({
      fallback: { title: 'T' },
      org,
      parentImages,
    });
    expect(meta.openGraph?.images).toEqual(parentImages);
  });

  it('mirrors images as plain URLs on the twitter card', () => {
    const seo: SeoConfig = { ogImageMode: 'custom', ogImageUrl: 'https://x/c.png' };
    const meta = resolveSeoMetadata({ seo, fallback: baseFallback, org });
    expect(meta.twitter?.images).toEqual(['https://x/c.png']);
  });
});

describe('resolveSeoMetadata — robots', () => {
  it('emits noindex when noIndex is set', () => {
    const meta = resolveSeoMetadata({ seo: { noIndex: true }, fallback: baseFallback, org });
    expect(meta.robots).toEqual({ index: false, follow: false });
  });

  it('omits robots otherwise', () => {
    const meta = resolveSeoMetadata({ fallback: baseFallback, org });
    expect(meta.robots).toBeUndefined();
  });
});

describe('resolveSeoMetadata — resilience', () => {
  it('does not throw on a null seo + missing org', () => {
    expect(() =>
      resolveSeoMetadata({ seo: null, fallback: { title: 'T' }, org: null }),
    ).not.toThrow();
  });
});

describe('mapLegacySurveySeo', () => {
  it('maps survey_banner to the asset mode', () => {
    const cfg = mapLegacySurveySeo({ seoOgImageMode: 'survey_banner' });
    expect(cfg?.ogImageMode).toBe('asset');
  });

  it('passes entity_logo and custom modes through unchanged', () => {
    expect(mapLegacySurveySeo({ seoOgImageMode: 'entity_logo' })?.ogImageMode).toBe('entity_logo');
    expect(mapLegacySurveySeo({ seoOgImageMode: 'custom' })?.ogImageMode).toBe('custom');
  });

  it('is a lossless mapping of populated fields', () => {
    const cfg = mapLegacySurveySeo({
      seoTitle: 'T',
      seoDescription: 'D',
      seoKeywords: 'a, b',
      seoOgImage: 'https://x/i.png',
      seoOgImageMode: 'custom',
      seoUseSurveyFallback: false,
    });
    expect(cfg).toEqual({
      title: 'T',
      description: 'D',
      keywords: 'a, b',
      ogImageUrl: 'https://x/i.png',
      ogImageMode: 'custom',
      useContentFallback: false,
    });
  });

  it('omits undefined keys rather than emitting them', () => {
    const cfg = mapLegacySurveySeo({ seoTitle: 'Only title' });
    expect(cfg).toEqual({ title: 'Only title' });
    expect('description' in (cfg ?? {})).toBe(false);
  });

  it('returns undefined for a fully empty legacy config', () => {
    expect(mapLegacySurveySeo({})).toBeUndefined();
    expect(mapLegacySurveySeo({ seoTitle: '', seoDescription: '   ' })).toBeUndefined();
  });

  it('round-trips into resolveSeoMetadata without throwing', () => {
    const cfg = mapLegacySurveySeo({ seoTitle: 'Legacy', seoOgImageMode: 'survey_banner' });
    const meta = resolveSeoMetadata({ seo: cfg, fallback: baseFallback, org });
    expect(meta.title).toBe('Legacy');
    expect(meta.openGraph?.images).toEqual([{ url: baseFallback.assetImageUrl }]);
  });
});

describe('surveyToSeoFormFields', () => {
  it('returns sensible defaults for a survey with no SEO data', () => {
    expect(surveyToSeoFormFields({})).toEqual({
      seoTitle: '',
      seoDescription: '',
      seoKeywords: '',
      seoOgImage: '',
      seoOgImageMode: 'survey_banner',
      seoUseSurveyFallback: true,
    });
  });

  it('prefers the nested seo object and maps asset → survey_banner', () => {
    const fields = surveyToSeoFormFields({
      seo: {
        title: 'N',
        description: 'D',
        keywords: 'k',
        ogImageUrl: 'https://x/i.png',
        ogImageMode: 'asset',
        useContentFallback: false,
      },
    });
    expect(fields).toEqual({
      seoTitle: 'N',
      seoDescription: 'D',
      seoKeywords: 'k',
      seoOgImage: 'https://x/i.png',
      seoOgImageMode: 'survey_banner',
      seoUseSurveyFallback: false,
    });
  });

  it('passes entity_logo / custom nested modes through to the form', () => {
    expect(surveyToSeoFormFields({ seo: { ogImageMode: 'entity_logo' } }).seoOgImageMode).toBe('entity_logo');
    expect(surveyToSeoFormFields({ seo: { ogImageMode: 'custom' } }).seoOgImageMode).toBe('custom');
  });

  it('falls back to legacy flat fields when no nested seo exists', () => {
    const fields = surveyToSeoFormFields({
      seoTitle: 'Legacy title',
      seoOgImageMode: 'custom',
      seoUseSurveyFallback: false,
    });
    expect(fields.seoTitle).toBe('Legacy title');
    expect(fields.seoOgImageMode).toBe('custom');
    expect(fields.seoUseSurveyFallback).toBe(false);
  });

  it('round-trips form fields → seo → form fields losslessly', () => {
    const original = surveyToSeoFormFields({
      seo: { title: 'T', keywords: 'a, b', ogImageMode: 'custom', ogImageUrl: 'https://x/c.png', useContentFallback: false },
    });
    const seo = mapLegacySurveySeo(original);
    const back = surveyToSeoFormFields({ seo });
    expect(back).toEqual(original);
  });
});

describe('migrateSurveyFormSeo', () => {
  it('replaces flat seo* fields with a nested seo object and preserves other fields', () => {
    const out = migrateSurveyFormSeo({
      title: 'My Survey',
      seoTitle: 'SEO T',
      seoOgImageMode: 'survey_banner',
      seoUseSurveyFallback: true,
    });
    expect(out.title).toBe('My Survey');
    expect(out.seoTitle).toBeUndefined();
    expect(out.seoOgImageMode).toBeUndefined();
    expect(out.seo).toEqual({ title: 'SEO T', ogImageMode: 'asset', useContentFallback: true });
  });

  it('drops any stale nested seo before rebuilding from the flat fields', () => {
    const out = migrateSurveyFormSeo({
      seo: { title: 'STALE', ogImageMode: 'custom' },
      seoTitle: 'Fresh',
      seoOgImageMode: 'survey_banner',
      seoUseSurveyFallback: false,
    });
    expect(out.seo).toEqual({ title: 'Fresh', ogImageMode: 'asset', useContentFallback: false });
  });

  it('omits the seo key entirely when there is nothing to store', () => {
    const out = migrateSurveyFormSeo({ title: 'X' });
    expect('seo' in out).toBe(false);
    expect(out.title).toBe('X');
  });

  it('does not mutate the input', () => {
    const input = { title: 'X', seoTitle: 'T', seoOgImageMode: 'custom' as const };
    const snapshot = JSON.stringify(input);
    migrateSurveyFormSeo(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
