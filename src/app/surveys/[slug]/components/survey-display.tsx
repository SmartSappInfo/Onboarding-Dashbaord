'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { Survey, OrgBranding } from '@/lib/types';
import Image from 'next/image';
import SurveyForm from './survey-form';
import { BackgroundPattern } from '../../components/survey-background-pattern';
import { Building2, RotateCcw, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SurveyLoader from '../../components/survey-loader';
import { useTheme } from 'next-themes';
import Footer from '@/components/footer';
import { useToast } from '@/hooks/use-toast';
import { submitPublicSurveyLead, finalizeSurveySubmission } from '@/lib/survey-actions';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';
import { useIframeHeightReporter } from '@/hooks/useIframeHeightReporter';

interface SurveyDisplayProps {
    survey: Survey;
    sourcePageId?: string;
    assignedUserId?: string;
    organizationLogoUrl?: string | null;
    entityLogoUrl?: string | null;
    orgBranding?: OrgBranding | null;
    resolvedWorkspaceId?: string;
}

export default function SurveyDisplay({ 
    survey, 
    sourcePageId, 
    assignedUserId, 
    organizationLogoUrl, 
    entityLogoUrl,
    orgBranding,
    resolvedWorkspaceId = ''
}: SurveyDisplayProps) {
    useIframeHeightReporter(survey.slug);

    const [isSubmitted, setIsSubmitted] = React.useState(false);
    const [showLeadCapture, setShowLeadCapture] = React.useState(false);
    const [submissionId, setSubmissionId] = React.useState<string | null>(null);
    const [score, setScore] = React.useState<number>(0);
    const [outcomeId, setOutcomeId] = React.useState<string | null>(null);
    const [isMounted, setIsMounted] = React.useState(false);
    const searchParams = useSearchParams();
    const { resolvedTheme, setTheme } = useTheme();
    const themeParam = searchParams?.get('theme');

    React.useEffect(() => {
        if (themeParam === 'dark' || themeParam === 'light') {
            setTheme(themeParam);
        }
    }, [themeParam, setTheme]);

    // Capture the full URL on mount so "Submit Another Response" preserves assignment params
    const initialUrl = React.useRef<string>('');
    
    // Logo resolution chain: survey logo → entity logo → org logo → null (generic avatar)
    const displayLogoUrl = survey.showBranding === false 
        ? 'none' 
        : (survey.logoUrl || entityLogoUrl || organizationLogoUrl || null);

    const handleQuestionsCompleted = (subId: string, finalScore: number, finalOutcomeId: string | null) => {
        setSubmissionId(subId);
        setScore(finalScore);
        setOutcomeId(finalOutcomeId);
        setShowLeadCapture(true);
    };

    React.useEffect(() => {
        initialUrl.current = window.location.href;
        setIsMounted(true);
    }, []);

    React.useEffect(() => {
        if (isSubmitted && survey.thankYouConfettiEnabled) {
            const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (reduceMotion) return;

            const burst = (opts: confetti.Options) =>
                confetti({
                    disableForReducedMotion: true,
                    colors: ['#5f30e2', '#ffc629', '#10b981', '#3B5FFF', '#e63946'],
                    ...opts,
                });

            burst({ particleCount: 160, spread: 100, startVelocity: 45, origin: { x: 0.5, y: 0.55 } });
            const sides = setTimeout(() => {
                burst({ particleCount: 60, angle: 60, spread: 70, origin: { x: 0, y: 0.7 } });
                burst({ particleCount: 60, angle: 120, spread: 70, origin: { x: 1, y: 0.7 } });
            }, 350);

            return () => clearTimeout(sides);
        }
    }, [isSubmitted, survey.thankYouConfettiEnabled]);

    const isDark = resolvedTheme === 'dark';
    const bgColor = isDark ? '#090d16' : (survey.backgroundColor || '#F1F5F9');
    const isEmbedded = searchParams?.get('embed') === 'true';
    const resolvedSourcePageId = searchParams?.get('sourcePageId') || sourcePageId;

    if (!isMounted) {
        return <SurveyLoader label="Customizing Your Survey..." logoUrl={displayLogoUrl} />;
    }

    if (isSubmitted) {
        return (
            <div className="min-h-screen flex flex-col justify-center relative" style={{ backgroundColor: isEmbedded ? 'transparent' : bgColor }}>
                 <BackgroundPattern pattern={survey.backgroundPattern} color={survey.patternColor} />
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
                 {!isEmbedded && orgBranding?.landingPageFooterEnabled !== false && (
                     <Footer orgBranding={orgBranding} className="bg-transparent text-slate-500 pt-8" />
                 )}
            </div>
        )
    }

    const hasCoverPage = !!survey.showCoverPage && survey.showSurveyTitles !== false;
    const showHeader = !!survey.showSurveyTitles;

    return (
        <div className="min-h-screen flex flex-col relative" style={{ backgroundColor: isEmbedded ? 'transparent' : bgColor }}>
            <BackgroundPattern pattern={survey.backgroundPattern} color={survey.patternColor} />
            <main className="flex-grow flex items-center justify-center relative z-10 py-8 sm:py-16">
                <div className="max-w-4xl w-full mx-auto px-4">
                    {/* Branding logo and Title are now handled natively inside SurveyForm to support both client-side and studio-preview consistency */}

                    {/* Title rendering is handled natively inside SurveyForm to support Preview builders */}

                    {showLeadCapture && submissionId ? (
                        <LeadCaptureFormView
                            survey={survey}
                            submissionId={submissionId}
                            workspaceId={resolvedWorkspaceId}
                            outcomeId={outcomeId}
                            onCompleted={() => setIsSubmitted(true)}
                        />
                    ) : (
                        <SurveyForm 
                            survey={survey} 
                            onSubmitted={() => setIsSubmitted(true)} 
                            onQuestionsCompleted={handleQuestionsCompleted}
                            sourcePageId={resolvedSourcePageId}
                            assignedUserId={assignedUserId}
                            resolvedLogoUrl={displayLogoUrl !== 'none' ? displayLogoUrl : undefined}
                        />
                    )}
                </div>
            </main>
             {!isEmbedded && orgBranding?.landingPageFooterEnabled !== false && (
                 <Footer orgBranding={orgBranding} className="bg-transparent text-slate-500 pt-8" />
             )}
        </div>
    );
}

interface LeadCaptureFormViewProps {
    survey: Survey;
    submissionId: string;
    workspaceId: string;
    outcomeId: string | null;
    onCompleted: () => void;
}

function LeadCaptureFormView({ survey, submissionId, workspaceId, outcomeId, onCompleted }: LeadCaptureFormViewProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [name, setName] = React.useState<string>('');
    const [email, setEmail] = React.useState<string>('');
    const [phone, setPhone] = React.useState<string>('');
    const [company, setCompany] = React.useState<string>('');
    const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
    const [errors, setErrors] = React.useState<Record<string, string>>({});

    const fieldsConfig = survey.leadCaptureFieldsConfig || {
        name: { show: true, label: 'Full Name', required: true },
        email: { show: true, label: 'Email Address', required: true },
        phone: { show: false, label: 'Phone Number', required: false },
        company: { show: false, label: 'Company Name', required: false }
    };

    const title = survey.leadCaptureTitle || 'Save Your Results';
    const description = survey.leadCaptureDescription || 'Kindly provide your details so that we can send you your results';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const nextErrors: Record<string, string> = {};
        if (fieldsConfig.name.show && fieldsConfig.name.required && !name.trim()) nextErrors.name = 'Name is required';
        if (fieldsConfig.email.show && fieldsConfig.email.required && !email.trim()) nextErrors.email = 'Email is required';
        if (fieldsConfig.phone.show && fieldsConfig.phone.required && !phone.trim()) nextErrors.phone = 'Phone number is required';
        if (fieldsConfig.company.show && fieldsConfig.company.required && !company.trim()) nextErrors.company = 'Company name is required';

        if (Object.keys(nextErrors).length > 0) {
            setErrors(nextErrors);
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await submitPublicSurveyLead(survey.id, submissionId, workspaceId, {
                name: fieldsConfig.name.show ? name : undefined,
                email: fieldsConfig.email.show ? email : undefined,
                phone: fieldsConfig.phone.show ? phone : undefined,
                company: fieldsConfig.company.show ? company : undefined
            }, outcomeId);

            if (res.success) {
                if (survey.scoringEnabled || (survey.resultRules && survey.resultRules.length > 0)) {
                    router.push(`/surveys/${survey.slug}/result/${submissionId}`);
                } else {
                    onCompleted();
                }
            } else {
                toast({ variant: 'destructive', title: 'Submission Failed', description: res.error || 'Please check fields.' });
            }
        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : 'Server error occurred.';
            toast({ variant: 'destructive', title: 'Submission Error', description: errMsg });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSkip = async () => {
        setIsSubmitting(true);
        try {
            const res = await finalizeSurveySubmission(survey.id, submissionId, workspaceId, outcomeId);
            if (res.success) {
                if (survey.scoringEnabled || (survey.resultRules && survey.resultRules.length > 0)) {
                    router.push(`/surveys/${survey.slug}/result/${submissionId}`);
                } else {
                    onCompleted();
                }
            } else {
                toast({ variant: 'destructive', title: 'Action Failed', description: res.error || 'Failed to skip.' });
            }
        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : 'Failed to skip.';
            toast({ variant: 'destructive', title: 'Error', description: errMsg });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="w-full max-w-xl mx-auto bg-card/60 dark:bg-slate-900/60 backdrop-blur-xl border border-border/80 dark:border-slate-800/80 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-500 text-left">
            <div className="space-y-2 text-center">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">{title}</h2>
                <p className="text-muted-foreground text-sm font-medium leading-relaxed max-w-md mx-auto">{description}</p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-5">
                {fieldsConfig.name.show && (
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{fieldsConfig.name.label}</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => { setName(e.target.value); if (errors.name) setErrors(prev => ({ ...prev, name: '' })); }}
                            className={cn(
                                "w-full h-12 rounded-xl bg-muted/20 border border-border/80 px-4 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
                                errors.name && "border-destructive focus:ring-destructive/20 focus:border-destructive"
                            )}
                            placeholder="Enter your name"
                        />
                        {errors.name && <p className="text-xs text-destructive font-semibold ml-1">{errors.name}</p>}
                    </div>
                )}
                {fieldsConfig.email.show && (
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{fieldsConfig.email.label}</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors(prev => ({ ...prev, email: '' })); }}
                            className={cn(
                                "w-full h-12 rounded-xl bg-muted/20 border border-border/80 px-4 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
                                errors.email && "border-destructive focus:ring-destructive/20 focus:border-destructive"
                            )}
                            placeholder="name@example.com"
                        />
                        {errors.email && <p className="text-xs text-destructive font-semibold ml-1">{errors.email}</p>}
                    </div>
                )}
                {fieldsConfig.phone.show && (
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{fieldsConfig.phone.label}</label>
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => { setPhone(e.target.value); if (errors.phone) setErrors(prev => ({ ...prev, phone: '' })); }}
                            className={cn(
                                "w-full h-12 rounded-xl bg-muted/20 border border-border/80 px-4 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
                                errors.phone && "border-destructive focus:ring-destructive/20 focus:border-destructive"
                            )}
                            placeholder="+1 (555) 000-0000"
                        />
                        {errors.phone && <p className="text-xs text-destructive font-semibold ml-1">{errors.phone}</p>}
                    </div>
                )}
                {fieldsConfig.company.show && (
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{fieldsConfig.company.label}</label>
                        <input
                            type="text"
                            value={company}
                            onChange={(e) => { setCompany(e.target.value); if (errors.company) setErrors(prev => ({ ...prev, company: '' })); }}
                            className={cn(
                                "w-full h-12 rounded-xl bg-muted/20 border border-border/80 px-4 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
                                errors.company && "border-destructive focus:ring-destructive/20 focus:border-destructive"
                            )}
                            placeholder="Enter company name"
                        />
                        {errors.company && <p className="text-xs text-destructive font-semibold ml-1">{errors.company}</p>}
                    </div>
                )}

                <div className="pt-4">
                    <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full h-14 rounded-2xl font-bold text-sm tracking-wide bg-gradient-to-r from-primary to-secondary text-white shadow-xl shadow-primary/20 transition-all duration-300 transform active:scale-95 flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? 'Processing...' : 'Submit & View Results'}
                    </Button>
                </div>
            </form>
        </div>
    );
}
