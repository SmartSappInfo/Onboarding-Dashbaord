import type { Metadata, ResolvingMetadata } from 'next';
import type { Survey } from '@/lib/types';
import SurveyDisplay from './components/survey-display';
import SurveyUnavailable from '../components/survey-unavailable';
import { notFound } from 'next/navigation';

import { adminDb } from '@/lib/firebase-admin';

import { cn, stripHtml, safeDecodeURI } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getSurveyBySlug(slug: string): Promise<Survey | null> {
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
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }, parent: ResolvingMetadata): Promise<Metadata> {
  const { slug } = await params;
  const survey = await getSurveyBySlug(slug);

  if (!survey || survey.status !== 'published') {
    return {
      title: 'Survey Unavailable | SmartSapp',
    };
  }
  
  const cleanDescription = stripHtml(survey.description);
  const previousImages = (await parent).openGraph?.images || [];

  return {
    title: survey.title,
    description: cleanDescription,
    openGraph: {
      title: survey.title,
      description: cleanDescription,
      images: survey.bannerImageUrl ? [survey.bannerImageUrl] : previousImages,
      type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: survey.title,
        description: cleanDescription,
        images: survey.bannerImageUrl ? [survey.bannerImageUrl] : [],
    }
  };
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
            const orgSnap = await adminDb.collection('organizations').doc(orgId).get();
            if (orgSnap.exists) {
                organizationLogoUrl = orgSnap.data()?.logoUrl || null;
            }
        }
    } catch (e) {
        console.error("Error fetching organization logo:", e);
    }

    // Block non-published surveys unless in preview mode
    if (survey.status !== 'published' && preview !== 'true') {
        return <SurveyUnavailable status={survey.status as any || 'draft'} survey={survey} logoUrl={survey.logoUrl || organizationLogoUrl} />;
    }
    
    return <SurveyDisplay survey={survey} sourcePageId={sourcePageId} assignedUserId={ref} organizationLogoUrl={organizationLogoUrl} />;
}


