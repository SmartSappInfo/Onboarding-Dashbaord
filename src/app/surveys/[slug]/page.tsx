import type { Metadata, ResolvingMetadata } from 'next';
import type { Survey } from '@/lib/types';
import SurveyDisplay from './components/survey-display';
import { notFound } from 'next/navigation';

import { firestore } from '@/firebase/config';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';

const stripHtml = (html: string) => html?.replace(/<[^>]*>?/gm, '') || '';

async function getSurveyBySlug(slug: string): Promise<Survey | null> {
    try {
        const surveysRef = collection(firestore, 'surveys');
        const q = query(
            surveysRef, 
            where('slug', '==', slug), 
            where('status', '==', 'published'), 
            limit(1)
        );
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return null;
        }
        
        const surveyDoc = querySnapshot.docs[0];
        return { ...surveyDoc.data(), id: surveyDoc.id } as Survey;
    } catch (error) {
        console.error("Error fetching survey by slug:", error);
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
    searchParams: Promise<{ sourcePageId?: string }>
}) {
    const { slug } = await params;
    const { sourcePageId } = await searchParams;
    const survey = await getSurveyBySlug(slug);

    if (!survey) {
        notFound();
    }
    
    return <SurveyDisplay survey={survey} sourcePageId={sourcePageId} />;
}

