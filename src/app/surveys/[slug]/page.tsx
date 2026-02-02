

'use client';

import { useParams } from 'next/navigation';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import * as React from 'react';
import type { Survey } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
import SurveyForm from './components/survey-form';
import { SmartSappLogo } from '@/components/icons';

function SurveyPageSkeleton() {
    return (
        <div className="max-w-2xl mx-auto py-12 px-4">
            <Skeleton className="h-40 w-full rounded-lg mb-8" />
            <Skeleton className="h-10 w-3/4 mb-4" />
            <Skeleton className="h-5 w-full mb-2" />
            <Skeleton className="h-5 w-5/6 mb-8" />

            <div className="space-y-6 mt-8">
                <div className="space-y-2">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-10 w-full" />
                </div>
                 <div className="space-y-2">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-24 w-full" />
                </div>
            </div>
        </div>
    );
}


export default function PublicSurveyPage() {
    const params = useParams();
    const slug = params.slug as string;
    const firestore = useFirestore();

    const [survey, setSurvey] = React.useState<Survey | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [isSubmitted, setIsSubmitted] = React.useState(false);

    React.useEffect(() => {
        if (!firestore || !slug) return;
        
        const fetchSurvey = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const surveysCollection = collection(firestore, 'surveys');
                const q = query(
                    surveysCollection,
                    where('slug', '==', slug),
                    where('status', '==', 'published'),
                    limit(1)
                );
                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    setError('Survey not found or is not currently active.');
                } else {
                    const surveyDoc = querySnapshot.docs[0];
                    setSurvey({ ...surveyDoc.data(), id: surveyDoc.id } as Survey);
                }
            } catch (e: any) {
                console.error(e);
                setError('Failed to load survey. Please try again later.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchSurvey();

    }, [firestore, slug]);
    
    if (isLoading) {
        return (
            <div className="bg-background min-h-screen">
                <SurveyPageSkeleton />
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-background min-h-screen flex items-center justify-center">
                <div className="text-center p-8">
                    <h1 className="text-2xl font-bold mb-4">An Error Occurred</h1>
                    <p className="text-destructive">{error}</p>
                </div>
            </div>
        );
    }

    if (!survey) {
        return (
             <div className="bg-background min-h-screen flex items-center justify-center">
                <div className="text-center p-8">
                    <h1 className="text-2xl font-bold mb-4">Survey Not Found</h1>
                    <p className="text-muted-foreground">The survey you are looking for could not be found.</p>
                </div>
            </div>
        );
    }
    
    if (isSubmitted) {
        return (
            <div className="bg-background min-h-screen flex items-center justify-center">
                 <div className="max-w-2xl mx-auto text-center p-8">
                     <SmartSappLogo className="h-12 mx-auto mb-8" />
                    <h1 className="text-3xl font-bold mb-4">{survey.thankYouTitle || 'Thank You!'}</h1>
                    <p className="text-muted-foreground text-lg">{survey.thankYouDescription || 'Your response has been submitted successfully.'}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-background min-h-screen">
            <div className="max-w-2xl mx-auto py-12 px-4">
                {survey.bannerImageUrl && (
                    <div className="relative w-full h-40 md:h-60 rounded-lg overflow-hidden mb-8">
                        <Image src={survey.bannerImageUrl} alt={survey.title} layout="fill" objectFit="cover" />
                    </div>
                )}
                <h1 className="text-3xl md:text-4xl font-bold mb-2">{survey.title}</h1>
                <p className="text-muted-foreground mb-8">{survey.description}</p>

                <SurveyForm survey={survey} onSubmitted={() => setIsSubmitted(true)} />
            </div>
        </div>
    );
}
