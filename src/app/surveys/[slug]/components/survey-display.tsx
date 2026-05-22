'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import type { Survey } from '@/lib/types';
import Image from 'next/image';
import SurveyForm from './survey-form';
import { BackgroundPattern } from '../../components/survey-background-pattern';
import { Building2, RotateCcw, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SurveyLoader from '../../components/survey-loader';
import { useTheme } from 'next-themes';

interface SurveyDisplayProps {
    survey: Survey;
    sourcePageId?: string;
    assignedUserId?: string;
    organizationLogoUrl?: string | null;
    entityLogoUrl?: string | null;
}

export default function SurveyDisplay({ survey, sourcePageId, assignedUserId, organizationLogoUrl, entityLogoUrl }: SurveyDisplayProps) {
    const [isSubmitted, setIsSubmitted] = React.useState(false);
    const [isMounted, setIsMounted] = React.useState(false);
    const searchParams = useSearchParams();
    const { resolvedTheme, setTheme } = useTheme();

    // Capture the full URL on mount so "Submit Another Response" preserves assignment params
    const initialUrl = React.useRef<string>('');
    
    // Logo resolution chain: survey logo → entity logo → org logo → null (generic avatar)
    const displayLogoUrl = survey.showBranding === false 
        ? 'none' 
        : (survey.logoUrl || entityLogoUrl || organizationLogoUrl || null);

    React.useEffect(() => {
        initialUrl.current = window.location.href;
        setIsMounted(true);
    }, []);
    
    const isDark = resolvedTheme === 'dark';
    const bgColor = isDark ? '#090d16' : (survey.backgroundColor || '#F1F5F9');

    if (!isMounted) {
        return <SurveyLoader label="Customizing Your Survey..." logoUrl={displayLogoUrl} />;
    }

    if (isSubmitted) {
        return (
            <div className="flex flex-col relative" style={{ backgroundColor: bgColor, minHeight: '100dvh' }}>
                 <BackgroundPattern pattern={survey.backgroundPattern} color={survey.patternColor} />
                 {isMounted && (
                     <div className="absolute top-4 right-4 z-50">
                         <Button 
                             variant="ghost" 
                             size="icon" 
                             className="h-10 w-10 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-muted-foreground dark:text-slate-400 hover:text-foreground dark:hover:text-slate-100 transition-all duration-300 active:scale-95" 
                             onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                         >
                             {resolvedTheme === 'dark' ? (
                                 <Sun className="h-5 w-5 text-yellow-500 animate-in spin-in-90 duration-500" />
                             ) : (
                                 <Moon className="h-5 w-5 text-slate-700 dark:text-slate-400 animate-in spin-in-90 duration-500" />
                             )}
                             <span className="sr-only">Toggle theme</span>
                         </Button>
                     </div>
                 )}
                 <main className="flex-1 flex items-center justify-center p-4 relative z-10 py-12">
                    <div className="max-w-4xl w-full mx-auto text-center animate-in fade-in zoom-in duration-500">
                        <div className="flex justify-center mb-6">
                            {displayLogoUrl !== 'none' && (
                                displayLogoUrl ? (
                                    <div className="relative h-10 w-40 sm:h-12 sm:w-48">
                                        <Image src={displayLogoUrl} alt="Logo" fill className="object-contain" />
                                    </div>
                                ) : (
                                    <Building2 className="h-10 w-10 sm:h-12 sm:w-12 text-primary/40" />
                                )
                            )}
                        </div>
                        {survey.bannerImageUrl && (
                            <div className="relative w-full rounded-2xl overflow-hidden mb-8 shadow-2xl border border-border/50 bg-card">
                                <Image 
                                    src={survey.bannerImageUrl} 
                                    alt={survey.title || 'Survey thank you banner'} 
                                    width={1200}
                                    height={400}
                                    className="w-full h-auto block object-contain"
                                />
                            </div>
                        )}
                        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 px-4">{survey.thankYouTitle || 'Thank You!'}</h1>
                        <div 
                            className="text-muted-foreground text-lg sm:text-xl px-4 whitespace-pre-wrap prose prose-slate max-w-none mx-auto" 
                            dangerouslySetInnerHTML={{ __html: survey.thankYouDescription || 'Your response has been recorded.' }} 
                        />
                        
                        {survey.allowResubmission && (
                            <div className="mt-8">
                                <Button 
                                    variant="outline" 
                                    size="lg" 
                                    className="rounded-xl font-semibold gap-2"
                                    onClick={() => {
                                        // Reload with original URL to preserve assignment query params
                                        window.location.href = initialUrl.current || window.location.pathname;
                                    }}
                                >
                                    <RotateCcw className="h-4 w-4" />
                                    Submit Another Response
                                </Button>
                            </div>
                        )}
                    </div>
                </main>
                  <footer className="mt-auto py-8 text-center text-xs sm:text-sm text-muted-foreground relative z-10 border-t border-black/5 dark:border-white/5">
                    <p>Powered by <a href="https://www.smartsapp.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">SmartSapp</a></p>
                    <p>&copy; {new Date().getFullYear()} SmartSapp</p>
                </footer>
            </div>
        )
    }

    const hasCoverPage = !!survey.showCoverPage && survey.showSurveyTitles !== false;
    const showHeader = !!survey.showSurveyTitles;

    return (
        <div className="min-h-screen flex flex-col relative" style={{ backgroundColor: bgColor }}>
            <BackgroundPattern pattern={survey.backgroundPattern} color={survey.patternColor} />
            {isMounted && (
                <div className="absolute top-4 right-4 z-50">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-10 w-10 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-muted-foreground dark:text-slate-400 hover:text-foreground dark:hover:text-slate-100 transition-all duration-300 active:scale-95" 
                        onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                    >
                        {resolvedTheme === 'dark' ? (
                            <Sun className="h-5 w-5 text-yellow-500 animate-in spin-in-90 duration-500" />
                        ) : (
                            <Moon className="h-5 w-5 text-slate-700 dark:text-slate-400 animate-in spin-in-90 duration-500" />
                        )}
                        <span className="sr-only">Toggle theme</span>
                    </Button>
                </div>
            )}
            <main className="flex-grow flex items-center justify-center relative z-10 py-8 sm:py-16">
                <div className="max-w-4xl w-full mx-auto px-4">
                    {/* Branding logo and Title are now handled natively inside SurveyForm to support both client-side and studio-preview consistency */}

                    {/* Title rendering is handled natively inside SurveyForm to support Preview builders */}

                    <SurveyForm 
                        survey={survey} 
                        onSubmitted={() => setIsSubmitted(true)} 
                        sourcePageId={sourcePageId}
                        assignedUserId={assignedUserId}
                        resolvedLogoUrl={displayLogoUrl !== 'none' ? displayLogoUrl : undefined}
                    />
                </div>
            </main>
            <footer className="py-8 text-center text-xs sm:text-sm text-muted-foreground relative z-10">
                <p>Powered by <a href="https://www.smartsapp.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">SmartSapp</a></p>
                <p>&copy; {new Date().getFullYear()} SmartSapp</p>
            </footer>
        </div>
    );
}
