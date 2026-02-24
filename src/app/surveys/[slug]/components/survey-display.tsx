'use client';

import * as React from 'react';
import type { Survey } from '@/lib/types';
import Image from 'next/image';
import SurveyForm from './survey-form';
import { SmartSappLogo } from '@/components/icons';
import { Skeleton } from '@/components/ui/skeleton';

interface SurveyDisplayProps {
    survey: Survey;
}

function SurveyFormSkeleton() {
    return (
        <div className="space-y-8">
            <div className="space-y-4">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-4">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-20 w-full" />
            </div>
            <div className="space-y-4">
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-10 w-1/2" />
            </div>
            <div className="flex justify-end">
                <Skeleton className="h-12 w-32" />
            </div>
        </div>
    );
}

export default function SurveyDisplay({ survey }: SurveyDisplayProps) {
    const [isSubmitted, setIsSubmitted] = React.useState(false);
    const [isMounted, setIsMounted] = React.useState(false);

    React.useEffect(() => {
        setIsMounted(true);
    }, []);
    
    if (isSubmitted) {
        return (
            <div className="light min-h-screen flex flex-col bg-slate-100">
                 <main className="flex-grow flex items-center justify-center p-4">
                    <div className="max-w-4xl w-full mx-auto text-center">
                        <div className="flex justify-center">
                          <SmartSappLogo className="h-12 mb-8" />
                        </div>
                        {survey.bannerImageUrl && (
                            <div className="relative w-full aspect-[3/1] rounded-lg overflow-hidden mb-8">
                                <Image 
                                    src={survey.bannerImageUrl} 
                                    alt={survey.title || 'Survey thank you banner'} 
                                    fill
                                    className="object-cover"
                                />
                            </div>
                        )}
                        <h1 className="text-3xl font-bold mb-4">{survey.thankYouTitle || 'Thank You!'}</h1>
                        <p className="text-muted-foreground text-lg">{survey.thankYouDescription || 'Your response has been recorded.'}</p>
                    </div>
                </main>
                 <footer className="py-8 text-center text-sm text-muted-foreground">
                    <p>Powered by <a href="https://www.smartsapp.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">SmartSapp</a></p>
                    <p>&copy; 2026 SmartSapp</p>
                </footer>
            </div>
        )
    }

    // Determine if we should show title/description based on if there's a cover page
    const firstElement = survey.elements[0];
    const hasCoverPage = firstElement?.type === 'section' && (firstElement as any).renderAsPage;

    return (
        <div className="light min-h-screen flex flex-col bg-slate-100">
            <main className="flex-grow">
                <div className="max-w-4xl mx-auto py-12 px-4">
                    {!hasCoverPage && (
                        <div className="text-center mb-8">
                            <div className="flex justify-center">
                                <SmartSappLogo className="h-12 mb-8" />
                            </div>
                            {survey.bannerImageUrl && (
                                <div className="relative w-full aspect-[3/1] rounded-lg overflow-hidden mb-8 shadow-lg">
                                    <Image src={survey.bannerImageUrl} alt={survey.title || ''} fill className="object-cover" />
                                </div>
                            )}
                            <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">{survey.title}</h1>
                            <div className="text-muted-foreground prose prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: survey.description }} />
                        </div>
                    )}

                    {isMounted ? (
                        <SurveyForm survey={survey} onSubmitted={() => setIsSubmitted(true)} />
                    ) : (
                        <SurveyFormSkeleton />
                    )}
                </div>
            </main>
            <footer className="py-8 text-center text-sm text-muted-foreground">
                <p>Powered by <a href="https://www.smartsapp.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">SmartSapp</a></p>
                <p>&copy; 2026 SmartSapp</p>
            </footer>
        </div>
    );
}
