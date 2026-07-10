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
import { submitPublicSurveyLead, finalizeSurveySubmission, getWorkspaceEntitiesForSimulationAction, logSurveyStartedAction } from '@/lib/survey-actions';
import { getVariableValuesMapAction } from '@/lib/services/fields-variables-service';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useIframeHeightReporter } from '@/hooks/useIframeHeightReporter';
import { AnimatePresence, motion } from 'framer-motion';


interface SurveyDisplayProps {
    survey: Survey;
    sourcePageId?: string;
    assignedUserId?: string;
    organizationLogoUrl?: string | null;
    entityLogoUrl?: string | null;
    orgBranding?: OrgBranding | null;
    resolvedWorkspaceId?: string;
    preloadedVariables?: Record<string, string>;
    resolvedEntityId?: string | null;
    resolvedRecipientContact?: string | null;
}

export default function SurveyDisplay({ 
    survey, 
    sourcePageId, 
    assignedUserId, 
    organizationLogoUrl, 
    entityLogoUrl,
    orgBranding,
    resolvedWorkspaceId = '',
    preloadedVariables = {},
    resolvedEntityId = null,
    resolvedRecipientContact = null
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

    const [entities, setEntities] = React.useState<any[]>([]);
    const [selectedEntityId, setSelectedEntityId] = React.useState<string>('none');
    const [selectedContactEmail, setSelectedContactEmail] = React.useState<string>('none');
    const [simulatedValues, setSimulatedValues] = React.useState<Record<string, string>>(preloadedVariables);
    const [isLoadingSimulation, setIsLoadingSimulation] = React.useState(false);

    const isPreviewMode = searchParams?.get('preview') === 'true';

    React.useEffect(() => {
        if (isPreviewMode && resolvedWorkspaceId) {
            getWorkspaceEntitiesForSimulationAction(resolvedWorkspaceId).then((data) => {
                setEntities(data);
                if (data.length > 0) {
                    setSelectedEntityId(data[0].id);
                    if (data[0].contacts && data[0].contacts.length > 0) {
                        setSelectedContactEmail(data[0].contacts[0].email);
                    }
                }
            }).catch(err => {
                console.error("Failed to load workspace entities for simulation:", err);
            });
        }
    }, [resolvedWorkspaceId, isPreviewMode]);

    React.useEffect(() => {
        console.log('[SurveyDisplay] Mount/Update. preloadedVariables:', preloadedVariables);
        console.log('[SurveyDisplay] isPreviewMode:', isPreviewMode, 'resolvedWorkspaceId:', resolvedWorkspaceId);
    }, [preloadedVariables, isPreviewMode, resolvedWorkspaceId]);

    React.useEffect(() => {
        if (isPreviewMode && resolvedWorkspaceId && selectedEntityId && selectedEntityId !== 'none') {
            console.log('[SurveyDisplay] Loading simulation values for entity:', selectedEntityId);
            setIsLoadingSimulation(true);
            getVariableValuesMapAction({
                workspaceId: resolvedWorkspaceId,
                entityId: selectedEntityId,
                recipientContact: selectedContactEmail && selectedContactEmail !== 'none' ? selectedContactEmail : undefined,
                surveyId: survey.id
            }).then((values) => {
                console.log('[SurveyDisplay] Loaded simulation values:', values);
                setSimulatedValues(values);
                setIsLoadingSimulation(false);
            }).catch(err => {
                console.error("[SurveyDisplay] Failed to fetch simulated variable values:", err);
                setIsLoadingSimulation(false);
            });
        } else if (isPreviewMode) {
            console.log('[SurveyDisplay] Clearing simulation values (preview mode else-branch).');
            setSimulatedValues({});
        }
    }, [selectedEntityId, selectedContactEmail, resolvedWorkspaceId, survey.id, isPreviewMode]);

    const handleEntityChange = (entityId: string) => {
        setSelectedEntityId(entityId);
        const match = entities.find(e => e.id === entityId);
        if (match && match.contacts && match.contacts.length > 0) {
            setSelectedContactEmail(match.contacts[0].email);
        } else {
            setSelectedContactEmail('none');
        }
    };

    const activeEntity = entities.find(e => e.id === selectedEntityId);
    const activeContacts = activeEntity?.contacts || [];

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

        if (!isPreviewMode && resolvedWorkspaceId && resolvedEntityId && resolvedRecipientContact) {
            logSurveyStartedAction({
                surveyId: survey.id,
                entityId: resolvedEntityId,
                contactEmail: resolvedRecipientContact,
                workspaceId: resolvedWorkspaceId,
                organizationId: survey.organizationId || 'default'
            }).catch((err: unknown) => {
                console.error('[SurveyDisplay] Failed to log survey_started action:', err);
            });
        }
    }, [isPreviewMode, resolvedWorkspaceId, resolvedEntityId, resolvedRecipientContact, survey.id, survey.organizationId]);

    React.useEffect(() => {
        if (isSubmitted) {
            if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
                window.parent.postMessage({
                    type: 'survey_submitted',
                    surveyId: survey.id,
                    submissionId: submissionId || undefined
                }, '*');
            }
        }
    }, [isSubmitted, survey.id, submissionId]);

    React.useEffect(() => {
        if (isSubmitted && survey.thankYouConfettiEnabled) {
            const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (reduceMotion) return;

            let active = true;
            let sidesTimer: NodeJS.Timeout;

            import('canvas-confetti').then(({ default: confetti }) => {
                if (!active) return;
                const burst = (opts: Record<string, unknown>) =>
                    confetti({
                        disableForReducedMotion: true,
                        colors: ['#5f30e2', '#ffc629', '#10b981', '#3B5FFF', '#e63946'],
                        ...opts,
                    });

                burst({ particleCount: 160, spread: 100, startVelocity: 45, origin: { x: 0.5, y: 0.55 } });
                sidesTimer = setTimeout(() => {
                    burst({ particleCount: 60, angle: 60, spread: 70, origin: { x: 0, y: 0.7 } });
                    burst({ particleCount: 60, angle: 120, spread: 70, origin: { x: 1, y: 0.7 } });
                }, 350);
            }).catch(console.error);

            return () => {
                active = false;
                if (sidesTimer) clearTimeout(sidesTimer);
            };
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
            <div className={cn("min-h-screen flex flex-col justify-center relative", isPreviewMode && "pt-16")} style={{ backgroundColor: isEmbedded ? 'transparent' : bgColor }}>
                {isPreviewMode && (
                    <div className="fixed top-0 left-0 w-full z-50 bg-slate-900 border-b border-slate-800 text-white px-4 py-3 shadow-md flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Simulation Mode</span>
                            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">
                                {survey.title}
                            </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-400">Simulate Entity:</span>
                                {entities.length > 0 ? (
                                    <Select value={selectedEntityId} onValueChange={handleEntityChange}>
                                        <SelectTrigger className="w-[180px] h-8 bg-slate-800 border-slate-700 text-white rounded-lg text-xs font-semibold focus:ring-0 focus:ring-offset-0">
                                            <SelectValue placeholder="Select Entity" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-800 border-slate-700 text-white rounded-xl">
                                            {entities.map((e) => (
                                                <SelectItem key={e.id} value={e.id} className="text-xs focus:bg-slate-700 focus:text-white rounded-lg">
                                                    {e.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <span className="text-xs text-slate-500 italic">No workspace entities found</span>
                                )}
                            </div>

                            {selectedEntityId !== 'none' && activeContacts.length > 0 && (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-slate-400">Contact:</span>
                                    <Select value={selectedContactEmail} onValueChange={setSelectedContactEmail}>
                                        <SelectTrigger className="w-[180px] h-8 bg-slate-800 border-slate-700 text-white rounded-lg text-xs font-semibold focus:ring-0 focus:ring-offset-0">
                                            <SelectValue placeholder="Select Contact" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-800 border-slate-700 text-white rounded-xl">
                                            {activeContacts.map((c: any) => (
                                                <SelectItem key={c.email || c.phone} value={c.email} className="text-xs focus:bg-slate-700 focus:text-white rounded-lg">
                                                    {c.name} ({c.typeLabel || c.typeKey || 'Contact'})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                 <BackgroundPattern pattern={survey.backgroundPattern} color={survey.patternColor} />
                 <main className="flex-1 flex items-center justify-center p-4 relative z-10 py-12">
                    <div className="max-w-4xl w-full mx-auto text-center animate-in fade-in zoom-in duration-500">
                        <div className="flex justify-center mb-6">
                            {displayLogoUrl !== 'none' && (
                                displayLogoUrl ? (
                                    <div className="relative h-10 w-40 sm:h-12 sm:w-48">
                                        <Image src={displayLogoUrl} alt="Logo" fill sizes="(max-width: 640px) 160px, 192px" className="object-contain" />
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
                  {!isEmbedded && survey.showFooter === true && orgBranding?.landingPageFooterEnabled !== false && (
                      <Footer orgBranding={orgBranding} className="bg-transparent text-slate-500 pt-8" />
                  )}
            </div>
        )
    }

    const hasCoverPage = !!survey.showCoverPage && survey.showSurveyTitles !== false;
    const showHeader = !!survey.showSurveyTitles;

    return (
        <div className={cn("min-h-screen flex flex-col relative", isPreviewMode && "pt-16")} style={{ backgroundColor: isEmbedded ? 'transparent' : bgColor }}>
            {isPreviewMode && (
                <div className="fixed top-0 left-0 w-full z-50 bg-slate-900 border-b border-slate-800 text-white px-4 py-3 shadow-md flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Simulation Mode</span>
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">
                            {survey.title}
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-400">Simulate Entity:</span>
                            {entities.length > 0 ? (
                                <Select value={selectedEntityId} onValueChange={handleEntityChange}>
                                    <SelectTrigger className="w-[180px] h-8 bg-slate-800 border-slate-700 text-white rounded-lg text-xs font-semibold focus:ring-0 focus:ring-offset-0">
                                        <SelectValue placeholder="Select Entity" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-800 border-slate-700 text-white rounded-xl">
                                        {entities.map((e) => (
                                            <SelectItem key={e.id} value={e.id} className="text-xs focus:bg-slate-700 focus:text-white rounded-lg">
                                                {e.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <span className="text-xs text-slate-500 italic">No workspace entities found</span>
                            )}
                        </div>

                        {selectedEntityId !== 'none' && activeContacts.length > 0 && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-400">Contact:</span>
                                <Select value={selectedContactEmail} onValueChange={setSelectedContactEmail}>
                                    <SelectTrigger className="w-[180px] h-8 bg-slate-800 border-slate-700 text-white rounded-lg text-xs font-semibold focus:ring-0 focus:ring-offset-0">
                                        <SelectValue placeholder="Select Contact" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-800 border-slate-700 text-white rounded-xl">
                                        {activeContacts.map((c: any) => (
                                            <SelectItem key={c.email || c.phone} value={c.email} className="text-xs focus:bg-slate-700 focus:text-white rounded-lg">
                                                {c.name} ({c.typeLabel || c.typeKey || 'Contact'})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                </div>
            )}
            <BackgroundPattern pattern={survey.backgroundPattern} color={survey.patternColor} />
            <main className="flex-grow flex items-center justify-center relative z-10 py-8 sm:py-16">
                <div className="max-w-4xl w-full mx-auto px-4">
                    {/* Branding logo and Title are now handled natively inside SurveyForm to support both client-side and studio-preview consistency */}

                    {/* Title rendering is handled natively inside SurveyForm to support Preview builders */}

                    <AnimatePresence mode="wait">
                        {showLeadCapture && submissionId ? (
                            <motion.div
                                key="lead-capture"
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -15 }}
                                transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                            >
                                <LeadCaptureFormView
                                    survey={survey}
                                    submissionId={submissionId}
                                    workspaceId={resolvedWorkspaceId}
                                    outcomeId={outcomeId}
                                    onCompleted={() => setIsSubmitted(true)}
                                    simulatedValues={simulatedValues}
                                />
                            </motion.div>
                        ) : (
                            <motion.div
                                key="survey-form"
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -15 }}
                                transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                            >
                                <SurveyForm 
                                    survey={survey} 
                                    onSubmitted={() => setIsSubmitted(true)} 
                                    onQuestionsCompleted={handleQuestionsCompleted}
                                    sourcePageId={resolvedSourcePageId}
                                    assignedUserId={assignedUserId}
                                    resolvedLogoUrl={displayLogoUrl !== 'none' ? displayLogoUrl : undefined}
                                    simulatedValues={simulatedValues}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </main>
              {!isEmbedded && survey.showFooter === true && orgBranding?.landingPageFooterEnabled !== false && (
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
    simulatedValues?: Record<string, string>;
}

function LeadCaptureFormView({ 
    survey, 
    submissionId, 
    workspaceId, 
    outcomeId, 
    onCompleted,
    simulatedValues = {}
}: LeadCaptureFormViewProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();

    const performLeadCaptureNavigation = (destination: string) => {
        let finalDestination = destination.trim();
        
        // Normalize external domains that lack protocol (e.g., localhost:9002/..., google.com)
        if (!finalDestination.startsWith('/') && !finalDestination.startsWith('http://') && !finalDestination.startsWith('https://')) {
            const hasDomain = finalDestination.includes('.') || finalDestination.startsWith('localhost');
            if (hasDomain) {
                finalDestination = `http://${finalDestination}`;
            } else {
                finalDestination = `/${finalDestination}`;
            }
        }

        const isInternal = finalDestination.startsWith('/');

        // Resolve absolute URL for parent navigation or external redirection
        let absoluteDestination = finalDestination;
        if (isInternal && typeof window !== 'undefined') {
            absoluteDestination = `${window.location.origin}${finalDestination}`;
        }

        const queryResultMode = searchParams?.get('resultMode') as 'modal' | 'parent' | null;
        const activeRedirectMode = queryResultMode || survey.embedRedirectMode || 'modal';

        // Always notify parent of completion
        if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
            window.parent.postMessage({
                type: 'survey_submitted',
                surveyId: survey.id,
                submissionId: submissionId,
                redirectUrl: absoluteDestination,
                embedRedirectMode: activeRedirectMode
            }, '*');
        }

        const isEmbedded = searchParams?.get('embed') === 'true';
        if (isEmbedded && activeRedirectMode === 'parent' && typeof window !== 'undefined' && window.parent && window.parent !== window) {
            try {
                window.parent.location.href = absoluteDestination;
                return;
            } catch (err: unknown) {
                console.warn("Parent redirection blocked by sandbox. Falling back to local redirect.", err);
            }
        }

        if (isInternal) {
            router.push(finalDestination);
        } else {
            window.location.href = finalDestination;
        }
    };

    const [name, setName] = React.useState<string>('');
    const [email, setEmail] = React.useState<string>('');
    const [phone, setPhone] = React.useState<string>('');
    const [company, setCompany] = React.useState<string>('');
    const [customValues, setCustomValues] = React.useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
    const [errors, setErrors] = React.useState<Record<string, string>>({});

    const hasAutoSubmitted = React.useRef(false);

    const fieldsConfig = survey.leadCaptureFieldsConfig || {
        name: { show: true, label: 'Full Name', required: true },
        email: { show: true, label: 'Email Address', required: true },
        phone: { show: false, label: 'Phone Number', required: false },
        company: { show: false, label: 'Company Name', required: false }
    };

    const title = survey.leadCaptureTitle || 'Save Your Results';
    const description = survey.leadCaptureDescription || 'Kindly provide your details so that we can send you your results';

    React.useEffect(() => {
        // Resolve initial values from preloaded/simulated variables map
        let resolvedName = name || simulatedValues.contact_name || simulatedValues.name || '';
        if (!resolvedName && (simulatedValues.contact_first_name || simulatedValues.contact_last_name)) {
            resolvedName = [simulatedValues.contact_first_name, simulatedValues.contact_last_name].filter(Boolean).join(' ');
        }
        const resolvedEmail = email || simulatedValues.contact_email || simulatedValues.email || '';
        const resolvedPhone = phone || simulatedValues.contact_phone || simulatedValues.phone || '';
        const resolvedCompany = company || simulatedValues.entity_name || simulatedValues.company || simulatedValues.school_name || '';

        console.log('[LeadCaptureFormView] Values check: name:', resolvedName, 'email:', resolvedEmail, 'phone:', resolvedPhone, 'company:', resolvedCompany);

        if (resolvedName && resolvedName !== name) setName(resolvedName);
        if (resolvedEmail && resolvedEmail !== email) setEmail(resolvedEmail);
        if (resolvedPhone && resolvedPhone !== phone) setPhone(resolvedPhone);
        if (resolvedCompany && resolvedCompany !== company) setCompany(resolvedCompany);

        const nextCustom = { ...customValues };
        let hasCustomUpdate = false;
        Object.keys(fieldsConfig).forEach(fKey => {
            if (fKey !== 'name' && fKey !== 'email' && fKey !== 'phone' && fKey !== 'company') {
                const val = simulatedValues[fKey];
                if (val && !nextCustom[fKey]) {
                    nextCustom[fKey] = val;
                    hasCustomUpdate = true;
                }
            }
        });
        if (hasCustomUpdate) {
            console.log('[LeadCaptureFormView] Custom fields pre-populated:', nextCustom);
            setCustomValues(nextCustom);
        }

        // Automatic silent skip verification
        const isNameValid = !fieldsConfig.name?.show || !fieldsConfig.name?.required || !!resolvedName.trim();
        const isEmailValid = !fieldsConfig.email?.show || !fieldsConfig.email?.required || !!resolvedEmail.trim();
        const isPhoneValid = !fieldsConfig.phone?.show || !fieldsConfig.phone?.required || !!resolvedPhone.trim();
        const isCompanyValid = !fieldsConfig.company?.show || !fieldsConfig.company?.required || !!resolvedCompany.trim();

        let isCustomValid = true;
        Object.keys(fieldsConfig).forEach(fKey => {
            if (fKey !== 'name' && fKey !== 'email' && fKey !== 'phone' && fKey !== 'company') {
                const fCfg = fieldsConfig[fKey];
                if (fCfg?.show && fCfg?.required && !(nextCustom[fKey] || '').trim()) {
                    isCustomValid = false;
                }
            }
        });

        console.log('[LeadCaptureFormView] Auto-submit flags:', {
            isNameValid,
            isEmailValid,
            isPhoneValid,
            isCompanyValid,
            isCustomValid,
            hasAutoSubmitted: hasAutoSubmitted.current,
            isPreview: searchParams?.get('preview') === 'true'
        });

        if (
            isNameValid &&
            isEmailValid &&
            isPhoneValid &&
            isCompanyValid &&
            isCustomValid &&
            !hasAutoSubmitted.current &&
            searchParams?.get('preview') !== 'true'
        ) {
            console.log('[LeadCaptureFormView] All checks passed! Launching auto-submit flow.');
            hasAutoSubmitted.current = true;
            
            const triggerAutoSubmit = async () => {
                setIsSubmitting(true);
                try {
                    const res = await submitPublicSurveyLead(survey.id, submissionId, workspaceId, {
                        name: fieldsConfig.name?.show ? resolvedName : undefined,
                        email: fieldsConfig.email?.show ? resolvedEmail : undefined,
                        phone: fieldsConfig.phone?.show ? resolvedPhone : undefined,
                        company: fieldsConfig.company?.show ? resolvedCompany : undefined,
                        ...nextCustom
                    }, outcomeId);

                    console.log('[LeadCaptureFormView] submitPublicSurveyLead response:', res);
                    if (res.success) {
                        const searchParamsObj = new URLSearchParams(window.location.search);
                        const queryStr = searchParamsObj.toString() ? `?${searchParamsObj.toString()}` : '';
                        performLeadCaptureNavigation(`/surveys/${survey.slug}/result/${submissionId}${queryStr}`);
                    } else {
                        console.warn('[Auto-Submit] Failed to auto-submit lead:', res.error);
                        setIsSubmitting(false);
                    }
                } catch (err) {
                    console.error('[Auto-Submit] Error auto-submitting lead:', err);
                    setIsSubmitting(false);
                }
            };
            triggerAutoSubmit();
        }
    }, [simulatedValues, fieldsConfig, survey, submissionId, workspaceId, outcomeId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const nextErrors: Record<string, string> = {};
        if (fieldsConfig.name?.show && fieldsConfig.name?.required && !name.trim()) nextErrors.name = 'Name is required';
        if (fieldsConfig.email?.show && fieldsConfig.email?.required && !email.trim()) nextErrors.email = 'Email is required';
        if (fieldsConfig.phone?.show && fieldsConfig.phone?.required && !phone.trim()) nextErrors.phone = 'Phone number is required';
        if (fieldsConfig.company?.show && fieldsConfig.company?.required && !company.trim()) nextErrors.company = 'Company name is required';

        // Custom fields validation
        Object.keys(fieldsConfig).forEach(fKey => {
            if (fKey !== 'name' && fKey !== 'email' && fKey !== 'phone' && fKey !== 'company') {
                const fCfg = fieldsConfig[fKey];
                if (fCfg?.show && fCfg?.required && !(customValues[fKey] || '').trim()) {
                    nextErrors[fKey] = `${fCfg.label || fKey} is required`;
                }
            }
        });

        if (Object.keys(nextErrors).length > 0) {
            setErrors(nextErrors);
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await submitPublicSurveyLead(survey.id, submissionId, workspaceId, {
                name: fieldsConfig.name?.show ? name : undefined,
                email: fieldsConfig.email?.show ? email : undefined,
                phone: fieldsConfig.phone?.show ? phone : undefined,
                company: fieldsConfig.company?.show ? company : undefined,
                ...customValues
            }, outcomeId);

            if (res.success) {
                if (survey.scoringEnabled) {
                    const searchParams = new URLSearchParams(window.location.search);
                    const queryStr = searchParams.toString() ? `?${searchParams.toString()}` : '';
                    performLeadCaptureNavigation(`/surveys/${survey.slug}/result/${submissionId}${queryStr}`);
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
                if (survey.scoringEnabled) {
                    const searchParams = new URLSearchParams(window.location.search);
                    const queryStr = searchParams.toString() ? `?${searchParams.toString()}` : '';
                    performLeadCaptureNavigation(`/surveys/${survey.slug}/result/${submissionId}${queryStr}`);
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

    if (isSubmitting) {
        return (
            <div className="w-full max-w-xl mx-auto bg-card/60 dark:bg-slate-900/60 backdrop-blur-xl border border-border/80 dark:border-slate-800/80 rounded-3xl p-10 sm:p-20 shadow-2xl flex items-center justify-center min-h-[400px]">
                <SurveyLoader 
                    label="Saving Your Profile & Loading Results..." 
                    logoUrl={survey.showBranding !== false ? (survey.logoUrl || null) : 'none'} 
                />
            </div>
        );
    }

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
                            placeholder={fieldsConfig.name.placeholder || "Enter your name"}
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
                            placeholder={fieldsConfig.email.placeholder || "name@example.com"}
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
                            placeholder={fieldsConfig.phone.placeholder || "+1 (555) 000-0000"}
                        />
                        {errors.phone && <p className="text-xs text-destructive font-semibold ml-1">{errors.phone}</p>}
                    </div>
                )}
                {fieldsConfig.company?.show && (
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
                            placeholder={fieldsConfig.company.placeholder || "Enter company name"}
                        />
                        {errors.company && <p className="text-xs text-destructive font-semibold ml-1">{errors.company}</p>}
                    </div>
                )}

                {Object.keys(fieldsConfig).map((fKey) => {
                    if (fKey === 'name' || fKey === 'email' || fKey === 'phone' || fKey === 'company') return null;
                    const fCfg = fieldsConfig[fKey];
                    if (!fCfg || !fCfg.show) return null;
                    return (
                        <div key={fKey} className="space-y-2 animate-in fade-in duration-200">
                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                {fCfg.label}
                                {fCfg.required && <span className="text-destructive ml-1">*</span>}
                            </label>
                            <input
                                type={fCfg.type === 'number' ? 'number' : fCfg.type === 'phone' ? 'tel' : fCfg.type === 'email' ? 'email' : 'text'}
                                value={customValues[fKey] || ''}
                                onChange={(e) => {
                                    setCustomValues(prev => ({ ...prev, [fKey]: e.target.value }));
                                    if (errors[fKey]) setErrors(prev => ({ ...prev, [fKey]: '' }));
                                }}
                                className={cn(
                                    "w-full h-12 rounded-xl bg-muted/20 border border-border/80 px-4 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
                                    errors[fKey] && "border-destructive focus:ring-destructive/20 focus:border-destructive"
                                )}
                                placeholder={fCfg.placeholder || `Enter your ${fCfg.label?.toLowerCase() || fKey}`}
                            />
                            {errors[fKey] && <p className="text-xs text-destructive font-semibold ml-1">{errors[fKey]}</p>}
                        </div>
                    );
                })}

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
