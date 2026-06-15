import type { Metadata, ResolvingMetadata } from 'next';
import { cache } from 'react';
import type { Survey } from '@/lib/types';
import SurveyDisplay from './components/survey-display';
import SurveyUnavailable from '../components/survey-unavailable';
import { notFound } from 'next/navigation';

import { adminDb } from '@/lib/firebase-admin';
import { getOrgBranding } from '@/lib/org-branding';
import { resolveSeoMetadata, mapLegacySurveySeo, normalizeParentImages } from '@/lib/seo';

import { cn, stripHtml, safeDecodeURI } from '@/lib/utils';


export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Wrapped in React.cache so generateMetadata and the page body share a single
// per-request fetch instead of querying Firestore twice.
const getSurveyBySlug = cache(async function getSurveyBySlug(slug: string): Promise<Survey | null> {
    const trimmedSlug = safeDecodeURI(slug).trim();
    console.log(`[PublicSurveyPage] Fetching survey for slug: "${trimmedSlug}"`);
    
    try {
        const surveysRef = adminDb.collection('surveys');
        
        // 1. Try querying by slug field
        const querySnapshot = await surveysRef.where('slug', '==', trimmedSlug).limit(1).get();

        if (!querySnapshot.empty) {
            const surveyDoc = querySnapshot.docs[0];
            const data = surveyDoc.data();
            console.log(`[PublicSurveyPage] Found survey by slug field. ID: ${surveyDoc.id}, Status: ${data?.status}`);
            return { ...data, id: surveyDoc.id } as Survey;
        }

        // 2. Fallback: Try fetching directly by document ID
        console.log(`[PublicSurveyPage] No match for slug field. Trying fallback to document ID: "${trimmedSlug}"`);
        const docSnap = await surveysRef.doc(trimmedSlug).get();

        if (docSnap.exists) {
            const data = docSnap.data();
            console.log(`[PublicSurveyPage] Found survey by document ID fallback. ID: ${docSnap.id}, Status: ${data?.status}`);
            return { ...data, id: docSnap.id } as Survey;
        }
        
        console.warn(`[PublicSurveyPage] Survey NOT FOUND for slug/id: "${trimmedSlug}"`);
        return null;
    } catch (error) {
        console.error(`[PublicSurveyPage] Error fetching survey for "${trimmedSlug}":`, error);
        return null;
    }
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }, parent: ResolvingMetadata): Promise<Metadata> {
  const { slug } = await params;
  const survey = await getSurveyBySlug(slug);

  if (!survey || survey.status !== 'published') {
    // Bare title — the root layout template appends "— SmartSapp" (avoids the
    // historical "… | SmartSapp — SmartSapp" double-branding).
    return { title: 'Survey Unavailable', robots: { index: false, follow: false } };
  }

  // Prefer the canonical nested `seo` object; fall back to legacy flat fields
  // until the migration backfills (Phase 3). Survey semantics: `entity_logo`
  // mode uses the survey's own logoUrl, so it is passed as the org logo.
  const seo = survey.seo ?? mapLegacySurveySeo(survey);

  return resolveSeoMetadata({
    seo,
    fallback: {
      title: survey.title,
      description: survey.description,
      assetImageUrl: survey.bannerImageUrl,
    },
    org: { logoUrl: survey.logoUrl },
    parentImages: normalizeParentImages((await parent).openGraph?.images),
  });
}


export default async function PublicSurveyPage({ 
    params,
    searchParams 
}: { 
    params: Promise<{ slug: string }>,
    searchParams: Promise<{ sourcePageId?: string, ref?: string, preview?: string }>
}) {
    const { slug } = await params;
    const { sourcePageId, ref, preview } = await searchParams;
    const survey = await getSurveyBySlug(slug);

    if (!survey) {
        return <SurveyUnavailable status="not_found" />;
    }

    let organizationLogoUrl: string | null = null;
    let entityLogoUrl: string | null = null;
    let orgBranding = null;
    try {
        // Resolve organizationId: direct field → workspace lookup
        let orgId = survey.organizationId;
        if (!orgId && survey.workspaceIds?.length) {
            const wsSnap = await adminDb.collection('workspaces').doc(survey.workspaceIds[0]).get();
            if (wsSnap.exists) {
                orgId = wsSnap.data()?.organizationId;
            }
        }
        if (orgId) {
            orgBranding = await getOrgBranding(orgId);
            organizationLogoUrl = orgBranding.logoUrl || null;
        }
        if (survey.entityId) {
            const entitySnap = await adminDb.collection('entities').doc(survey.entityId).get();
            if (entitySnap.exists) {
                const entityData = entitySnap.data();
                entityLogoUrl = entityData?.institutionData?.logoUrl || entityData?.logoUrl || null;
            }
        }
    } catch (e) {
        console.error("Error fetching organization or entity logo:", e);
    }

    // Block non-published surveys unless in preview mode
    if (survey.status !== 'published' && preview !== 'true') {
        return <SurveyUnavailable status={survey.status as any || 'draft'} survey={survey} logoUrl={survey.logoUrl || entityLogoUrl || organizationLogoUrl} />;
    }

    const primaryColor = orgBranding?.brandPrimaryColor || '#3B5FFF';
    const secondaryColor = orgBranding?.brandSecondaryColor || '#8B5CF6';
    const brandFont = orgBranding?.brandFontFamily || 'Inter';

    const themeStyles = `
        :root {
            --primary: ${primaryColor};
            --secondary: ${secondaryColor};
            --radius: 1rem;
        }
        body {
            font-family: ${brandFont}, sans-serif;
        }
    `;
    
    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: themeStyles }} />
            <SurveyDisplay survey={survey} sourcePageId={sourcePageId} assignedUserId={ref} organizationLogoUrl={organizationLogoUrl} entityLogoUrl={entityLogoUrl} />
        </>
    );
}


