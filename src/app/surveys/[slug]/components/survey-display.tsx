'use client';

import * as React from 'react';
import type { Survey } from '@/lib/types';
import { useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import Image from 'next/image';
import SurveyForm from './survey-form';
import { SmartSappLogo } from '@/components/icons';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import SurveyLoader from '../../components/survey-loader';

interface SurveyDisplayProps {
    survey: Survey;
}

const BackgroundPattern = ({ pattern, color }: { pattern?: Survey['backgroundPattern'], color?: string }) => {
    if (!pattern || pattern === 'none') return null;

    if (pattern === 'gradient') {
        return (
            <div className="absolute inset-0 bg-gradient-to-br from-[#6366f1] via-[#a855f7] to-[#ec4899] opacity-90" />
        );
    }

    const patterns: Record<string, React.ReactNode> = {
        dots: (
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                        <circle cx="2" cy="2" r="1" fill={color || "currentColor"} opacity="0.1" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#dots)" />
            </svg>
        ),
        grid: (
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern id="grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke={color || "currentColor"} strokeWidth="1" opacity="0.05" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
        ),
        circuit: (
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern id="circuit" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
                        <path d="M0 10h20v10H0zM30 30h40v10H30zM80 50h20v10H80zM10 70h30v10H10zM60 80h20v10H60z" fill="none" stroke={color || "currentColor"} strokeWidth="0.5" opacity="0.05" />
                        <circle cx="20" cy="15" r="2" fill={color || "currentColor"} opacity="0.1" />
                        <circle cx="70" cy="35" r="2" fill={color || "currentColor"} opacity="0.1" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#circuit)" />
            </svg>
        ),
        topography: (
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern id="topo" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
                        <path d="M0 50c20-10 40-10 60 0s40 10 60 0M0 20c20-10 40-10 60 0s40 10 60 0M0 80c20-10 40-10 60 0s40 10 60 0" fill="none" stroke={color || "currentColor"} strokeWidth="1" opacity="0.05" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#topo)" />
            </svg>
        ),
        cubes: (
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern id="cubes" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
                        <path d="M30 0l30 15v30L30 60 0 45V15z" fill="none" stroke={color || "currentColor"} strokeWidth="1" opacity="0.05" />
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

    const firestore = useFirestore();
    const schoolDocRef = React.useMemo(() => {
        if (!firestore || !survey.schoolId) return null;
        return doc(firestore, 'schools', survey.schoolId);
    }, [firestore, survey.schoolId]);
    
    const { data: school } = useDoc<any>(schoolDocRef);
    
    const displayLogoUrl = survey.logoUrl || school?.logoUrl || school?.branding?.logoUrl;

    React.useEffect(() => {
        setIsMounted(true);
    }, []);
    
    const bgColor = survey.backgroundColor || '#F1F5F9';

    if (!isMounted) {
        return <SurveyLoader label="Customizing Your Survey..." />;
    }

    if (isSubmitted) {
        return (
            <div className="light min-h-screen flex flex-col relative" style={{ backgroundColor: bgColor }}>
                 <BackgroundPattern pattern={survey.backgroundPattern} color={survey.patternColor} />
                 <main className="flex-grow flex items-center justify-center p-4 relative z-10">
                    <div className="max-w-4xl w-full mx-auto text-center">
                        <div className="flex justify-center mb-8">
                          {displayLogoUrl ? (
                              <div className="relative h-10 w-40 sm:h-12 sm:w-48">
                                  <Image src={displayLogoUrl} alt="Logo" fill className="object-contain" />
                              </div>
                          ) : (
                              <SmartSappLogo className="h-10 sm:h-12" />
                          )}
                        </div>
                        {survey.bannerImageUrl && (
                            <div className="relative w-full rounded-2xl overflow-hidden mb-8 shadow-2xl border-4 border-white bg-white">
                                <Image 
                                    src={survey.bannerImageUrl} 
                                    alt={survey.title || 'Survey thank you banner'} 
                                    width={1200}
                                    height={400}
                                    className="w-full h-auto block"
                                />
                            </div>
                        )}
                        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 px-4">{survey.thankYouTitle || 'Thank You!'}</h1>
                        <p className="text-muted-foreground text-lg sm:text-xl px-4">{survey.thankYouDescription || 'Your response has been recorded.'}</p>
                    </div>
                </main>
                 <footer className="py-8 text-center text-xs sm:text-sm text-muted-foreground relative z-10">
                    <p>Powered by <a href="https://www.smartsapp.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">SmartSapp</a></p>
                    <p>&copy; {new Date().getFullYear()} SmartSapp</p>
                </footer>
            </div>
        )
    }

    const hasCoverPage = !!survey.showCoverPage && survey.showSurveyTitles !== false;
    const showHeader = !!survey.showSurveyTitles;

    return (
        <div className="light min-h-screen flex flex-col relative" style={{ backgroundColor: bgColor }}>
            <BackgroundPattern pattern={survey.backgroundPattern} color={survey.patternColor} />
            <main className="flex-grow relative z-10">
                <div className="max-w-4xl mx-auto py-5 sm:py-10 px-4">
                    {/* Persistent Logo Header */}
                    <div className="flex justify-center mb-6 sm:mb-8">
                        {displayLogoUrl ? (
                            <div className="relative h-10 w-40 sm:h-12 sm:w-48">
                                <Image src={displayLogoUrl} alt="Logo" fill className="object-contain" />
                            </div>
                        ) : (
                            <SmartSappLogo className="h-10 sm:h-12" />
                        )}
                    </div>

                    {!hasCoverPage && (
                        <div className="text-center mb-3 sm:mb-4">
                            {showHeader && (
                                <>
                                    {survey.bannerImageUrl && (
                                        <div className="relative w-full rounded-2xl overflow-hidden mb-8 sm:mb-12 shadow-2xl border-4 border-white bg-white">
                                            <Image 
                                                src={survey.bannerImageUrl} 
                                                alt={survey.title || ''} 
                                                width={1200}
                                                height={400}
                                                className="w-full h-auto block" 
                                                priority 
                                            />
                                        </div>
                                    )}
                                    <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6 text-foreground px-2 leading-tight">{survey.title}</h1>
                                    <div className="text-lg sm:text-xl text-muted-foreground prose prose-slate max-w-none px-4 font-medium leading-relaxed whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: survey.description }} />
                                </>
                            )}
                        </div>
                    )}

                    <SurveyForm survey={survey} onSubmitted={() => setIsSubmitted(true)} />
                </div>
            </main>
            <footer className="py-8 text-center text-xs sm:text-sm text-muted-foreground relative z-10">
                <p>Powered by <a href="https://www.smartsapp.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">SmartSapp</a></p>
                <p>&copy; {new Date().getFullYear()} SmartSapp</p>
            </footer>
        </div>
    );
}
