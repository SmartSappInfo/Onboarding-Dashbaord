'use client';

import * as React from 'react';
import type { Survey } from '@/lib/types';
import Image from 'next/image';
import SurveyForm from './survey-form';
import { SmartSappLogo } from '@/components/icons';
import { Skeleton } from '@/components/ui/skeleton';
import FloatingLines from '@/components/FloatingLines';

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
            <div className="light bg-background min-h-screen flex flex-col relative isolate">
                 <div className="absolute inset-0 z-[-1]">
                    <FloatingLines
                        linesGradient={["#454cb0","#4361db","#d270ff"]}
                        animationSpeed={1}
                        interactive
                        bendRadius={8}
                        bendStrength={-0.4}
                        mouseDamping={0.05}
                        parallax
                        parallaxStrength={0.2}
                    />
                </div>
                 <main className="flex-grow flex items-center justify-center p-4">
                    <div className="max-w-2xl w-full mx-auto text-center">
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
                        <p className="text-muted-foreground text-lg">{survey.thankYouDescription || 'Your response has been submitted successfully.'}</p>
                    </div>
                </main>
                 <footer className="py-8 text-center text-sm text-muted-foreground">
                    <p>Powered by <a href="https://www.smartsapp.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">SmartSapp</a></p>
                    <p>&copy; 2026 SmartSapp</p>
                </footer>
            </div>
        )
    }

    return (
        <div className="light bg-background min-h-screen flex flex-col relative isolate">
            <div className="absolute inset-0 z-[-1]">
                <FloatingLines
                    linesGradient={["#454cb0","#4361db","#d270ff"]}
                    animationSpeed={1}
                    interactive
                    bendRadius={8}
                    bendStrength={-0.4}
                    mouseDamping={0.05}
                    parallax
                    parallaxStrength={0.2}
                />
            </div>
            <main className="flex-grow">
                <div className="max-w-2xl mx-auto py-12 px-4">
                    <div className="flex justify-center">
                      <SmartSappLogo className="h-12 mb-8" />
                    </div>
                    {survey.bannerImageUrl && (
                        <div className="relative w-full aspect-[3/1] rounded-lg overflow-hidden mb-8">
                            <Image src={survey.bannerImageUrl} alt={survey.title || ''} fill className="object-cover" />
                        </div>
                    )}
                    <h1 className="text-3xl md:text-4xl font-bold mb-2">{survey.title}</h1>
                    <p className="text-muted-foreground mb-8">{survey.description}</p>

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
