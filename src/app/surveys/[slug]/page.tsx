import type { Metadata, ResolvingMetadata } from 'next';
import type { Survey } from '@/lib/types';
import SurveyDisplay from './components/survey-display';
import SurveyUnavailable from '../components/survey-unavailable';
import { notFound } from 'next/navigation';

import { firestore } from '@/firebase/config';
import { collection, query, where, limit, getDocs, doc, getDoc } from 'firebase/firestore';

import { cn, stripHtml } from '@/lib/utils';

async function getSurveyBySlug(slug: string): Promise<Survey | null> {
    try {
        const surveysRef = collection(firestore, 'surveys');
        
        // 1. Try querying by slug field
        const q = query(
            surveysRef, 
            where('slug', '==', slug), 
            limit(1)
        );
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const surveyDoc = querySnapshot.docs[0];
            return { ...surveyDoc.data(), id: surveyDoc.id } as Survey;
        }

        // 2. Fallback: Try fetching directly by document ID
        const docRef = doc(firestore, 'surveys', slug);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return { ...docSnap.data(), id: docSnap.id } as Survey;
        }
        
        return null;
    } catch (error) {
        console.error("Error fetching survey by slug/id:", error);
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
            const wsDoc = await getDoc(doc(firestore, 'workspaces', survey.workspaceIds[0]));
            if (wsDoc.exists()) {
                orgId = wsDoc.data().organizationId;
            }
        }
        if (orgId) {
            const orgDoc = await getDoc(doc(firestore, 'organizations', orgId));
            if (orgDoc.exists()) {
                organizationLogoUrl = orgDoc.data().logoUrl || null;
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


