import { adminDb } from '@/lib/firebase-admin';
import type { Metadata, ResolvingMetadata } from 'next';
import type { Survey } from '@/lib/types';
import SurveyDisplay from './components/survey-display';
import { notFound } from 'next/navigation';

async function getSurveyBySlug(slug: string): Promise<Survey | null> {
    try {
        const querySnapshot = await adminDb.collection('surveys')
            .where('slug', '==', slug)
            .where('status', '==', 'published')
            .limit(1)
            .get();

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
  
  const previousImages = (await parent).openGraph?.images || [];

  return {
    title: survey.title,
    description: survey.description,
    openGraph: {
      title: survey.title,
      description: survey.description,
      images: survey.bannerImageUrl ? [survey.bannerImageUrl, ...previousImages] : previousImages,
    },
  };
}


export default async function PublicSurveyPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const survey = await getSurveyBySlug(slug);

    if (!survey) {
        notFound();
    }
    
    return <SurveyDisplay survey={survey} />;
}
