# Dynamic Organization-Specific SEO Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend resolveSeoMetadata to dynamically resolve page Site Name and Twitter site handle based on organization settings, and resolve the organization context for all public surveys.

**Architecture:** Update `ResolveSeoInput` parameter types to pass full `OrgBranding` details. Resolve organization metadata dynamically inside the public survey route generation. Introduce extraction logic to cleanly retrieve Twitter handles from stored links.

**Tech Stack:** Next.js Server Components, Firebase Admin SDK, Vitest.

---

## Technical Considerations & Risk Mitigation

### 1. What Could Go Wrong & Solutions
* **Undefined Org Name or Social Links**: Organizations may not have filled out their name or Twitter link in settings.
  * *Mitigation*: Gracefully fallback to `'SmartSapp'` and `'@smartsapp'` using strict coalesce operators.
* **Complex Twitter URLs**: Twitter links might contain trailing slashes or subdomains (e.g. `http://www.twitter.com/Greenwood/status/123`).
  * *Mitigation*: Implement a robust regular expression pattern that extracts only the handle name and filters out query/subdomain parts.
* **Performance Impact in Survey Route**: Performing recursive queries for workspace configuration inside `generateMetadata` could increase page load time.
  * *Mitigation*: Leverage React's `cache` function to share workspace and organization document fetches between `generateMetadata` and the page route body.

### 2. Clean & Testable Code Practices
* **No `any` or `any[]` types**: Use strict structural interfaces and type mappings.
* **Test Isolation**: Update existing vitest mock data to include realistic organization structures and test the logic in isolation.

### 3. Firebase Rules & Indexes
* **Rule configuration**: The `organizations` collection must allow read access so that client/server SDKs can resolve branding. This is already covered under `match /organizations/{orgId}` in `firestore.rules` allowing read if signed in or matching the ID.
* **Indexes**: No new compound indexes are required as all organizations are queried directly by their unique document ID.

---

### Task 1: Update SEO Types & Core Resolver

**Files:**
- Modify: `src/lib/seo.ts`
- Test: `src/lib/__tests__/seo.test.ts`

- [ ] **Step 1: Write failing tests for organization-specific SEO tags**
Add the following tests to `src/lib/__tests__/seo.test.ts`:
```typescript
describe('resolveSeoMetadata — organization specific details', () => {
  it('uses organization name as siteName if provided', () => {
    const customOrg = {
      logoUrl: 'https://cdn.example.com/logo.png',
      brandPrimaryColor: '#000',
      brandSecondaryColor: '#111',
      brandFontFamily: 'Inter',
      name: 'Greenwood International',
    };
    const meta = resolveSeoMetadata({ fallback: baseFallback, org: customOrg });
    expect(meta.openGraph?.siteName).toBe('Greenwood International');
  });

  it('extracts and binds organization Twitter handle if available', () => {
    const customOrg = {
      logoUrl: 'https://cdn.example.com/logo.png',
      brandPrimaryColor: '#000',
      brandSecondaryColor: '#111',
      brandFontFamily: 'Inter',
      name: 'Greenwood International',
      socialLinks: {
        twitter: 'https://twitter.com/greenwood_school',
      },
    };
    const meta = resolveSeoMetadata({ fallback: baseFallback, org: customOrg });
    expect(meta.twitter?.site).toBe('@greenwood_school');
  });

  it('falls back to defaults if org name or Twitter link is missing', () => {
    const meta = resolveSeoMetadata({ fallback: baseFallback, org: null });
    expect(meta.openGraph?.siteName).toBe('SmartSapp');
    expect(meta.twitter?.site).toBe('@smartsapp');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm test src/lib/__tests__/seo.test.ts --run`
Expected: FAIL with compilation errors or assertion failures for org properties.

- [ ] **Step 3: Modify resolveSeoMetadata and ResolveSeoInput in src/lib/seo.ts**
```typescript
export interface ResolveSeoInput {
  seo?: SeoConfig | null;
  fallback: {
    title: string;
    description?: string;
    assetImageUrl?: string;
  };
  org?: Pick<OrgBranding, 'logoUrl' | 'name' | 'socialLinks'> | { logoUrl?: string | null; name?: string | null; socialLinks?: OrgBranding['socialLinks'] | null } | null;
  title?: TitleStrategy;
  parentImages?: OgImage[];
  path?: string;
}

function extractTwitterHandle(url?: string | null): string | undefined {
  if (!url) return undefined;
  const match = url.match(/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]{1,15})/i);
  return match ? `@${match[1]}` : undefined;
}

export function resolveSeoMetadata(input: ResolveSeoInput): Metadata {
  const { seo, fallback, org } = input;
  const titleStrategy: TitleStrategy = input.title ?? { mode: 'brand' };

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
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm test src/lib/__tests__/seo.test.ts --run`
Expected: PASS

- [ ] **Step 5: Commit changes**
```bash
git add src/lib/seo.ts src/lib/__tests__/seo.test.ts
git commit -m "feat(seo): make metadata siteName and twitter handle organization specific"
```

---

### Task 2: Resolve Org Branding in Public Survey Route

**Files:**
- Modify: `src/app/surveys/[slug]/page.tsx`

- [ ] **Step 1: Update generateMetadata in src/app/surveys/[slug]/page.tsx**
Resolve the organization branding dynamically on surveys metadata generation:
```typescript
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }, parent: ResolvingMetadata): Promise<Metadata> {
  const { slug } = await params;
  const survey = await getSurveyBySlug(slug);

  if (!survey || survey.status !== 'published') {
    return { title: 'Survey Unavailable', robots: { index: false, follow: false } };
  }

  const seo = survey.seo ?? mapLegacySurveySeo(survey);

  // Fetch full organization branding context using survey metadata
  let orgId = survey.organizationId;
  if (!orgId && survey.workspaceIds?.length) {
    const wsSnap = await adminDb.collection('workspaces').doc(survey.workspaceIds[0]).get();
    if (wsSnap.exists) {
      orgId = wsSnap.data()?.organizationId;
    }
  }
  const org = orgId ? await getOrgBranding(orgId) : null;

  return resolveSeoMetadata({
    seo,
    fallback: {
      title: survey.title,
      description: survey.description,
      assetImageUrl: survey.bannerImageUrl,
    },
    org: org || { logoUrl: survey.logoUrl },
    parentImages: normalizeParentImages((await parent).openGraph?.images),
    path: `/surveys/${slug}`,
  });
}
```

- [ ] **Step 2: Run verification checks**
Run: `pnpm typecheck`
Expected: PASS with zero type errors.

- [ ] **Step 3: Commit changes**
```bash
git add src/app/surveys/[slug]/page.tsx
git commit -m "feat(seo): resolve full organization branding in public surveys metadata"
```

---

### Task 3: Build & Final Verification

- [ ] **Step 1: Run full production build verification**
Run: `pnpm build`
Expected: PASS with clean page output optimization.
