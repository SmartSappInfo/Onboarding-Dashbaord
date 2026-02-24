
'use client';

import * as React from 'react';
import type { Survey } from '@/lib/types';
import Image from 'next/image';
import SurveyForm from './survey-form';
import { SmartSappLogo } from '@/components/icons';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

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

const BackgroundPattern = ({ pattern }: { pattern?: Survey['backgroundPattern'] }) => {
    if (!pattern || pattern === 'none') return null;

    const patterns: Record<string, React.ReactNode> = {
        dots: (
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                        <circle cx="2" cy="2" r="1" fill="currentColor" opacity="0.1" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#dots)" />
            </svg>
        ),
        grid: (
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern id="grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.05" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
        ),
        circuit: (
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern id="circuit" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
                        <path d="M0 10h20v10H0zM30 30h40v10H30zM80 50h20v10H80zM10 70h30v10H10zM60 80h20v10H60z" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.05" />
                        <circle cx="20" cy="15" r="2" fill="currentColor" opacity="0.1" />
                        <circle cx="70" cy="35" r="2" fill="currentColor" opacity="0.1" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#circuit)" />
            </svg>
        ),
        topography: (
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern id="topo" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
                        <path d="M0 50c20-10 40-10 60 0s40 10 60 0M0 20c20-10 40-10 60 0s40 10 60 0M0 80c20-10 40-10 60 0s40 10 60 0" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.05" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#topo)" />
            </svg>
        ),
        cubes: (
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern id="cubes" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
                        <path d="M30 0l30 15v30L30 60 0 45V15z" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.05" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#cubes)" />
            </svg>
        )
    };

    return (
        <div className="absolute inset-0 pointer-events-none text-foreground/20">
            {patterns[pattern]}
        </div>
    );
};

export default function SurveyDisplay({ survey }: SurveyDisplayProps) {
    const [isSubmitted, setIsSubmitted] = React.useState(false);
    const [isMounted, setIsMounted] = React.useState(false);

    React.useEffect(() => {
        setIsMounted(true);
    }, []);
    
    const bgColor = survey.backgroundColor || '#F1F5F9';

    if (isSubmitted) {
        return (
            <div className="light min-h-screen flex flex-col relative" style={{ backgroundColor: bgColor }}>
                 <BackgroundPattern pattern={survey.backgroundPattern} />
                 <main className="flex-grow flex items-center justify-center p-4 relative z-10">
                    <div className="max-w-4xl w-full mx-auto text-center">
                        <div className="flex justify-center mb-8">
                          {survey.logoUrl ? (
                              <div className="relative h-12 w-48">
                                  <Image src={survey.logoUrl} alt="Logo" fill className="object-contain" />
                              </div>
                          ) : (
                              <SmartSappLogo className="h-12" />
                          )}
                        </div>
                        {survey.bannerImageUrl && (
                            <div className="relative w-full aspect-[3/1] rounded-lg overflow-hidden mb-8 shadow-xl">
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
                 <footer className="py-8 text-center text-sm text-muted-foreground relative z-10">
                    <p>Powered by <a href="https://www.smartsapp.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">SmartSapp</a></p>
                    <p>&copy; 2026 SmartSapp</p>
                </footer>
            </div>
        )
    }

    const hasCoverPage = !!survey.showCoverPage;

    return (
        <div className="light min-h-screen flex flex-col relative" style={{ backgroundColor: bgColor }}>
            <BackgroundPattern pattern={survey.backgroundPattern} />
            <main className="flex-grow relative z-10">
                <div className="max-w-4xl mx-auto py-12 px-4">
                    {!hasCoverPage && (
                        <div className="text-center mb-12">
                            <div className="flex justify-center mb-8">
                                {survey.logoUrl ? (
                                    <div className="relative h-12 w-48">
                                        <Image src={survey.logoUrl} alt="Logo" fill className="object-contain" />
                                    </div>
                                ) : (
                                    <SmartSappLogo className="h-12" />
                                )}
                            </div>
                            {survey.bannerImageUrl && (
                                <div className="relative w-full aspect-[3/1] rounded-2xl overflow-hidden mb-10 shadow-2xl border-4 border-white">
                                    <Image src={survey.bannerImageUrl} alt={survey.title || ''} fill className="object-cover" priority />
                                </div>
                            )}
                            <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4 text-foreground">{survey.title}</h1>
                            <div className="text-lg text-muted-foreground prose prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: survey.description }} />
                        </div>
                    )}

                    {isMounted ? (
                        <SurveyForm survey={survey} onSubmitted={() => setIsSubmitted(true)} />
                    ) : (
                        <SurveyFormSkeleton />
                    )}
                </div>
            </main>
            <footer className="py-8 text-center text-sm text-muted-foreground relative z-10">
                <p>Powered by <a href="https://www.smartsapp.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">SmartSapp</a></p>
                <p>&copy; 2026 SmartSapp</p>
            </footer>
        </div>
    );
}
