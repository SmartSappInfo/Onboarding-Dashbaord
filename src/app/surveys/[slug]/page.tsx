import { collection, query, where, getDocs, limit, getFirestore } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import type { Metadata, ResolvingMetadata } from 'next';
import type { Survey } from '@/lib/types';
import SurveyDisplay from './components/survey-display';
import { notFound } from 'next/navigation';

// Server-side Firebase initialization. Avoids using the client-side module.
function getDb() {
  if (!getApps().length) {
    initializeApp(firebaseConfig);
  }
  return getFirestore(getApp());
}

async function getSurveyBySlug(slug: string): Promise<Survey | null> {
    const db = getDb();
    const surveysCollection = collection(db, 'surveys');
    const q = query(
        surveysCollection,
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
