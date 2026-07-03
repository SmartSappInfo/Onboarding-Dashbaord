import type { Metadata } from 'next';
import type { OrgBranding, SeoConfig, Survey } from './types';
import { stripHtml } from './utils';

/**
 * @fileOverview Pure, surface-agnostic SEO metadata resolver.
 *
 * The single source of truth for turning a stored {@link SeoConfig} (plus
 * sensible per-surface fallbacks and org branding) into a Next.js
 * {@link Metadata} object. It performs **no I/O** and **never throws** — every
 * public `generateMetadata` should delegate here so that titles, descriptions,
 * Open Graph and Twitter cards, keywords and robots directives are produced
 * identically across surveys, campaign pages, meetings, forms and signing docs.
 *
 * Consumed by the public route `generateMetadata` functions (see Phase 2).
 */

/** Minimal Open Graph image shape this resolver produces and consumes. */
type OgImage = { url: string };

/**
 * Controls how the document `<title>` is branded.
 * - `brand`    → returns a bare title; the root layout template (`%s — SmartSapp`)
 *                appends the brand. Use for normal content pages.
 * - `absolute` → returns the exact string (optionally with `suffix`), bypassing
 *                the template. Use for error/utility titles to avoid the
 *                historical "… | SmartSapp — SmartSapp" double-branding.
 */
export type TitleStrategy =
  | { mode: 'brand' }
  | { mode: 'absolute'; suffix?: string };

export interface ResolveSeoInput {
  /** Stored SEO overrides for this content item, if any. */
  seo?: SeoConfig | null;
  /** Per-surface fallbacks used when an override is absent. */
  fallback: {
    title: string;
    description?: string;
    /** The content's own banner/hero/cover image, used for `ogImageMode: 'asset'`. */
    assetImageUrl?: string;
  };
  /**
   * Owning organization branding; supplies the logo for `ogImageMode: 'entity_logo'`.
   * Only `logoUrl` is read, so callers may pass a full {@link OrgBranding} or a
   * minimal `{ logoUrl }` (e.g. a per-content logo override).
   */
  org?: Pick<OrgBranding, 'logoUrl' | 'name' | 'socialLinks'> | { logoUrl?: string | null; name?: string | null; socialLinks?: OrgBranding['socialLinks'] | null } | null;
  /** Title branding strategy. Defaults to `{ mode: 'brand' }`. */
  title?: TitleStrategy;
  /** Inherited OG images from a parent segment, used as a last resort. */
  parentImages?: OgImage[];
  /** NEW: Relative path of the page to generate canonical URLs. */
  path?: string;
}

/** Trim → drop empties; returns `undefined` rather than an empty string. */
function clean(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Resolves the social preview image URL according to `ogImageMode`, gracefully
 * degrading to the content asset, then to any inherited parent images.
 */
function resolveOgImages(input: ResolveSeoInput): OgImage[] {
  const { seo, fallback, org, parentImages } = input;
  const asset = clean(fallback.assetImageUrl);

  let url: string | undefined;
  switch (seo?.ogImageMode) {
    case 'custom':
      url = clean(seo.ogImageUrl) ?? asset;
      break;
    case 'entity_logo':
      url = clean(org?.logoUrl) ?? asset;
      break;
    case 'asset':
    default:
      url = asset;
      break;
  }

  if (url) return [{ url }];
  return parentImages ?? [];
}

/**
 * Normalizes Next's loose parent Open Graph images (string | URL | object |
 * arrays thereof) into the resolver's {@link OgImage} shape. Use at call sites
 * that forward `(await parent).openGraph?.images` so types stay clean.
 */
export function normalizeParentImages(images: unknown): OgImage[] | undefined {
  if (!images) return undefined;
  const arr = Array.isArray(images) ? images : [images];
  const out: OgImage[] = [];
  for (const img of arr) {
    if (typeof img === 'string') {
      out.push({ url: img });
    } else if (img instanceof URL) {
      out.push({ url: img.toString() });
    } else if (img && typeof img === 'object' && 'url' in img) {
      const u = (img as { url: unknown }).url;
      if (typeof u === 'string') out.push({ url: u });
      else if (u instanceof URL) out.push({ url: u.toString() });
    }
  }
  return out.length ? out : undefined;
}

/** Comma-separated keyword string → de-duplicated array, or `undefined`. */
function resolveKeywords(keywords?: string): string[] | undefined {
  if (!keywords) return undefined;
  const parts = Array.from(
    new Set(
      keywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean),
    ),
  );
  return parts.length ? parts : undefined;
}

function extractTwitterHandle(url?: string | null): string | undefined {
  if (!url) return undefined;
  const match = url.match(/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]{1,30})/i);
  return match ? `@${match[1]}` : undefined;
}

/**
 * Maps a {@link SeoConfig} (with fallbacks + branding) into a Next.js
 * {@link Metadata} object. Pure and total — safe to call inside a `try/catch`
 * but designed never to throw on malformed input.
 */
export function resolveSeoMetadata(input: ResolveSeoInput): Metadata {
  const { seo, fallback, org } = input;
  const titleStrategy: TitleStrategy = input.title ?? { mode: 'brand' };

  // When the content fallback is forced, ignore stored title/description overrides.
  const useFallback = seo?.useContentFallback === true;
  const displayTitle =
    (!useFallback ? clean(seo?.title) : undefined) ?? clean(fallback.title) ?? '';
  const rawDescription =
    (!useFallback ? clean(seo?.description) : undefined) ?? clean(fallback.description);
  const description = rawDescription ? clean(stripHtml(rawDescription)) : undefined;

  const keywords = resolveKeywords(seo?.keywords);
  const images = resolveOgImages(input);
  const imageUrls = images.map((img) => img.url);

  const titleField: Metadata['title'] =
    titleStrategy.mode === 'absolute'
      ? { absolute: `${displayTitle}${titleStrategy.suffix ?? ''}` }
      : displayTitle;

  const siteUrl = 'https://go.smartsapp.com';
  const canonicalUrl = input.path ? `${siteUrl}${input.path === '/' ? '' : input.path}` : undefined;

  return {
    metadataBase: new URL(siteUrl),
    title: titleField,
    description,
    keywords,
    robots: seo?.noIndex ? { index: false, follow: false } : undefined,
    alternates: canonicalUrl ? { canonical: canonicalUrl } : undefined,
    openGraph: {
      title: displayTitle,
      description,
      images,
      type: 'website',
      siteName: org?.name || 'SmartSapp',
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: displayTitle,
      description,
      images: imageUrls,
      site: extractTwitterHandle(org?.socialLinks?.twitter) || '@smartsapp',
    },
  };
}

/**
 * Maps a survey's legacy flat `seo*` fields onto the canonical {@link SeoConfig}
 * shape. Used both as a transitional read-fallback (Phase 2) and by the
 * backfill migration (Phase 3). Pure — returns `undefined` only when there is
 * genuinely nothing to map.
 */
export function mapLegacySurveySeo(
  survey: Pick<
    Survey,
    | 'seoTitle'
    | 'seoDescription'
    | 'seoKeywords'
    | 'seoOgImage'
    | 'seoOgImageMode'
    | 'seoUseSurveyFallback'
  >,
): SeoConfig | undefined {
  const ogImageMode =
    survey.seoOgImageMode === 'survey_banner'
      ? 'asset'
      : survey.seoOgImageMode; // 'entity_logo' | 'custom' | undefined pass through

  const config: SeoConfig = {
    title: clean(survey.seoTitle),
    description: clean(survey.seoDescription),
    keywords: clean(survey.seoKeywords),
    ogImageUrl: clean(survey.seoOgImage),
    ogImageMode,
    useContentFallback: survey.seoUseSurveyFallback,
  };

  // Strip undefined keys so callers can detect an "empty" config and omit it.
  const hasValue = Object.values(config).some((v) => v !== undefined);
  if (!hasValue) return undefined;

  (Object.keys(config) as (keyof SeoConfig)[]).forEach((key) => {
    if (config[key] === undefined) delete config[key];
  });

  return config;
}

/**
 * Replaces a survey form payload's flat `seo*` fields (and any stale nested
 * `seo`) with the canonical nested {@link SeoConfig}, ready for persistence.
 * Pure; the input is treated as immutable. If there is nothing to store, the
 * `seo` key is omitted entirely (rather than writing an empty object).
 */
export function migrateSurveyFormSeo(formData: Record<string, any>): Record<string, any> {
  const seo = mapLegacySurveySeo(formData);
  const {
    seoTitle: _seoTitle,
    seoDescription: _seoDescription,
    seoKeywords: _seoKeywords,
    seoOgImage: _seoOgImage,
    seoOgImageMode: _seoOgImageMode,
    seoUseSurveyFallback: _seoUseSurveyFallback,
    seo: _staleSeo,
    ...rest
  } = formData;
  return seo ? { ...rest, seo } : rest;
}

/**
 * The flat shape used by the survey wizard's react-hook-form. Field names are
 * intentionally the legacy survey field names so {@link mapLegacySurveySeo} can
 * map the form values straight to a {@link SeoConfig} at save time.
 */
export interface SurveySeoFormFields {
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  seoOgImage: string;
  seoOgImageMode: 'survey_banner' | 'entity_logo' | 'custom';
  seoUseSurveyFallback: boolean;
}

/**
 * Projects a survey onto the flat form-field shape for the editor's default
 * values. Prefers the canonical nested `seo` object, falling back to legacy
 * flat fields (so in-flight, not-yet-migrated surveys still populate the form).
 * Maps the nested `asset` mode back to the form's `survey_banner` label.
 */
export function surveyToSeoFormFields(
  survey: Partial<
    Pick<
      Survey,
      | 'seo'
      | 'seoTitle'
      | 'seoDescription'
      | 'seoKeywords'
      | 'seoOgImage'
      | 'seoOgImageMode'
      | 'seoUseSurveyFallback'
    >
  >,
): SurveySeoFormFields {
  const seo = survey.seo;
  const nestedMode = seo?.ogImageMode;
  const formMode: SurveySeoFormFields['seoOgImageMode'] =
    nestedMode === 'asset'
      ? 'survey_banner'
      : (nestedMode ?? survey.seoOgImageMode ?? 'survey_banner');

  return {
    seoTitle: seo?.title ?? survey.seoTitle ?? '',
    seoDescription: seo?.description ?? survey.seoDescription ?? '',
    seoKeywords: seo?.keywords ?? survey.seoKeywords ?? '',
    seoOgImage: seo?.ogImageUrl ?? survey.seoOgImage ?? '',
    seoOgImageMode: formMode,
    seoUseSurveyFallback: seo?.useContentFallback ?? survey.seoUseSurveyFallback ?? true,
  };
}
