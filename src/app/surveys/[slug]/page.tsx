import type { Metadata, ResolvingMetadata } from 'next';
import type { Survey } from '@/lib/types';
import SurveyDisplay from './components/survey-display';
import { notFound } from 'next/navigation';

import { firestore } from '@/firebase/config';
import { collection, query, where, limit, getDocs, doc, getDoc } from 'firebase/firestore';

const stripHtml = (html: string) => html?.replace(/<[^>]*>?/gm, '') || '';

async function getSurveyBySlug(slug: string): Promise<Survey | null> {
    try {
        const surveysRef = collection(firestore, 'surveys');
        
        // 1. Try querying by slug field
        // We use a single-field query to avoid potential composite index requirements
        const q = query(
            surveysRef, 
            where('slug', '==', slug), 
            limit(1)
        );
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const surveyDoc = querySnapshot.docs[0];
            const data = surveyDoc.data();
            // Ensure the survey is not archived
            if (data.status !== 'archived') {
                return { ...data, id: surveyDoc.id } as Survey;
            }
        }

        // 2. Fallback: Try fetching directly by document ID
        // This handles cases where unique links might use the document ID directly
        const docRef = doc(firestore, 'surveys', slug);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            // Ensure the survey is not archived
            if (data.status !== 'archived') {
                return { ...data, id: docSnap.id } as Survey;
            }
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

  if (!survey) {
    return {
      title: 'Survey Not Found',
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
    searchParams: Promise<{ sourcePageId?: string, ref?: string }>
}) {
    const { slug } = await params;
    const { sourcePageId, ref } = await searchParams;
    const survey = await getSurveyBySlug(slug);

    if (!survey) {
        notFound();
    }
    
    return <SurveyDisplay survey={survey} sourcePageId={sourcePageId} assignedUserId={ref} />;
}

