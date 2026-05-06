'use client';

import * as React from 'react';
import { use, useEffect, useState, useCallback, useRef } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import type { CampaignPage, CampaignPageVersion, PageTrigger, PageTriggerAction } from '@/lib/types';
import { Loader2, PlusSquare, X, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SmartSappLogo } from '@/components/icons';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { submitStandaloneFormAction } from '@/lib/form-actions';
import { getThemesAction } from '@/lib/theme-actions';
import { recordPageViewAction, recordInteractionAction } from '@/lib/analytics-actions';
import { useSearchParams } from 'next/navigation';
import type { CampaignPageTheme } from '@/lib/types';
import { PaymentMethodCard } from '@/components/portal/PaymentMethodCard';
import SUBSCRIPTION_PAYMENT_DATA from './payment-guide-data.json';
import { sendReceiptAcknowledgementAction } from '@/lib/notification-actions';



// ─── Trigger Execution Engine ─────────────────────────────────────────────
function useTriggerEngine(page: CampaignPage | null) {
    const [modalState, setModalState] = useState<{
        type: 'survey' | 'form' | 'agreement';
        targetId: string;
    } | {
        type: 'receipt_request';
    } | null>(null);
    const firedRef = useRef<Set<string>>(new Set());

    const executeActions = useCallback(async (actions: PageTriggerAction[]) => {
        for (const action of actions) {
            switch (action.type) {
                case 'open_modal':
                    if (action.config.modalType && action.config.targetId) {
                        setModalState({
                            type: action.config.modalType,
                            targetId: action.config.targetId
                        });
                    }
                    break;
                case 'redirect':
                    if (action.config.url) {
                        window.location.href = action.config.url;
                    }
                    break;
                case 'trigger_automation':
                    // Server-side only — handled by form/survey submission actions
                    console.log(`>>> [TRIGGER] Automation ${action.config.automationId} queued (handled server-side)`);
                    break;
                case 'scroll_to':
                    if (action.config.targetId) {
                        const el = document.getElementById(action.config.targetId);
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }
                    break;
                case 'trigger_webhook':

                    if (action.config.url) {
                        try {
                            await fetch(action.config.url, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ pageId: page?.id, timestamp: new Date().toISOString() }),
                                mode: 'no-cors'
                            });
                        } catch (e) {
                            console.error('>>> [TRIGGER] Webhook failed:', e);
                        }
                    }
                    break;
            }
        }
    }, [page]);

    // Typography Hydration
    useEffect(() => {
        if (!page) return;
        const font = page.settings.themeOverrides?.typography?.primaryFont || 'Inter';
        if (font && !['Inter', 'Roboto'].includes(font)) {
            let fontLink = document.querySelector(`link[href*="family=${font.replace(' ', '+')}"]`);
            if (!fontLink) {
                fontLink = document.createElement('link');
                fontLink.setAttribute('rel', 'stylesheet');
                fontLink.setAttribute('href', `https://fonts.googleapis.com/css2?family=${font.replace(' ', '+')}:wght@400;500;700;900&display=swap`);
                document.head.appendChild(fontLink);
            }
        }
        document.body.style.fontFamily = font + ', sans-serif';
    }, [page]);


    const fireTrigger = useCallback((event: PageTrigger['event'], blockId?: string) => {
        if (!page) return;

        // Record interaction for clicks
        if (event === 'block_click') {
            recordInteractionAction(page.id, blockId);
        }

        if (!page?.settings.triggers) return;


        const matching = page.settings.triggers.filter(t => {
            if (t.event !== event) return false;
            if ((event === 'block_click' || event === 'form_submitted') && t.targetBlockId && t.targetBlockId !== blockId) return false;
            return true;
        });

        for (const trigger of matching) {
            // Prevent double-firing
            if ((event === 'page_load' || event === 'on_exit') && firedRef.current.has(trigger.id)) continue;
            firedRef.current.add(trigger.id);
            executeActions(trigger.actions);
        }
    }, [page, executeActions]);

    // Auto-fire page_load triggers
    useEffect(() => {
        if (page) {
            fireTrigger('page_load');
        }
    }, [page, fireTrigger]);

    // Exit Intent Implementation
    useEffect(() => {
        if (!page) return;
        const onMouseLeave = (e: MouseEvent) => {
            if (e.clientY <= 0) {
                fireTrigger('on_exit');
            }
        };
        document.addEventListener('mouseleave', onMouseLeave);
        return () => document.removeEventListener('mouseleave', onMouseLeave);
    }, [page, fireTrigger]);

    return { modalState, setModalState, fireTrigger };
}

// ─── Personalization Engine ──────────────────────────────────────────────
function usePersonalization(page: CampaignPage | null) {
    const searchParams = useSearchParams();

    const interpolate = useCallback((text: string = '') => {
        if (!text || !text.includes('{{')) return text;
        
        return text.replace(/\{\{([^}]+)\}\}/g, (_, match) => {
            const [key, defaultValue] = match.split('|').map((s: string) => s.trim());
            const value = searchParams?.get(key);
            return value || defaultValue || '';
        });
    }, [searchParams]);

    return { interpolate };
}



// ─── Embedded Form Modal ──────────────────────────────────────────────────
// ─── Reusable Form Component ──────────────────────────────────────────────
function EmbeddedForm({ 
    formId, 
    pageId, 
    blockId,
    onSuccess,
    isInModal = false 
}: { 
    formId: string; 
    pageId: string; 
    blockId?: string;
    onSuccess?: () => void;
    isInModal?: boolean;
}) {
    const db = useFirestore();
    const [form, setForm] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [formValues, setFormValues] = useState<Record<string, any>>({});
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (!db) return;
        const load = async () => {
            try {
                const snap = await getDoc(doc(db, 'forms', formId));
                if (snap.exists()) setForm({ id: snap.id, ...snap.data() });
            } catch (e) {
                console.error('Failed to load form', e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [db, formId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form) return;
        setSubmitting(true);
        try {
            const result = await submitStandaloneFormAction(
                formId,
                formValues,
                form.workspaceId,
                form.organizationId,
                { sourcePageId: pageId }
            );
            if (result.success) {
                setSuccess(true);
                if (onSuccess) onSuccess();
            } else {
                throw new Error(result.error);
            }
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Submission Error', description: err.message });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
    if (!form) return <div className="text-center py-8 text-muted-foreground">Form not found</div>;

    if (success) {
        return (
            <div className={cn("text-center space-y-6 py-8 animate-in zoom-in duration-500", !isInModal && "max-w-md mx-auto p-10 bg-white rounded-[2.5rem] shadow-2xl ring-1 ring-black/5")}>
                <div className="h-20 w-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">Thank You!</h2>
                <p className="text-slate-500 font-medium text-sm px-4">
                    {form.successBehavior?.value || "Your response has been recorded."}
                </p>
                {isInModal && (
                    <Button variant="outline" onClick={onSuccess} className="rounded-xl font-bold h-10 px-6 text-sm">
                        Close
                    </Button>
                )}
            </div>
        );
    }

    return (
        <form 
            className={cn("space-y-5", !isInModal && "max-w-md mx-auto p-10 bg-white rounded-[2.5rem] shadow-2xl ring-1 ring-black/5 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-150")} 
            onSubmit={handleSubmit}
        >
            <div className="space-y-1 mb-6 text-left">
                <h2 className="text-xl font-bold tracking-tight">{form.title}</h2>
                {form.description && <p className="text-sm text-muted-foreground">{form.description}</p>}
            </div>
            {form.fields?.map((field: any, idx: number) => (
                <div key={field.id || idx} className="space-y-2 text-left">
                    <Label className="text-sm font-semibold ml-1 text-slate-700">
                        {field.labelOverride || field.label || `Field ${idx + 1}`}
                        {field.required && <span className="text-red-500 ml-0.5">*</span>}
                    </Label>
                    <Input
                        required={field.required}
                        placeholder={field.placeholderOverride || `Enter value...`}
                        onChange={(e) => setFormValues(prev => ({ ...prev, [field.appFieldId || field.id]: e.target.value }))}
                        className="h-12 rounded-xl bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                    />
                </div>
            ))}
            <Button
                disabled={submitting}
                className="w-full h-14 rounded-2xl font-black text-base shadow-xl shadow-primary/20 hover:-translate-y-0.5 active:translate-y-0 transition-all group gap-3 mt-4"
            >
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                    <>
                        {form.theme?.ctaLabel || 'Submit'}
                        <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </>
                )}
            </Button>
            {!isInModal && (
                <p className="text-[10px] text-center text-slate-400 mt-8 font-bold uppercase tracking-[0.2em] opacity-50 flex items-center justify-center gap-2">
                    <span className="h-px bg-slate-100 flex-1" />
                    Powered by SmartSapp
                    <span className="h-px bg-slate-100 flex-1" />
                </p>
            )}
        </form>
    );
}

// ─── Embedded Survey Component ─────────────────────────────────────────────
function EmbeddedSurvey({ surveyId, pageId, onClose, isInModal = false }: { surveyId: string; pageId: string; onClose?: () => void; isInModal?: boolean }) {
    return (
        <div className={cn("text-center space-y-6 py-12", !isInModal && "max-w-md mx-auto p-12 bg-white rounded-[2.5rem] shadow-2xl ring-1 ring-black/5 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-150")}>
            <div className="w-16 h-16 bg-indigo-100 rounded-3xl flex items-center justify-center mx-auto mb-2">
                <PlusSquare className="h-8 w-8 text-indigo-600" />
            </div>
            <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">Complete Our Survey</h2>
                <p className="text-sm text-muted-foreground px-4">Help us improve by sharing your feedback. This will open in a new tab.</p>
            </div>
            <div className="flex flex-col gap-3 px-6">
                <Button
                    onClick={() => window.open(`/surveys/${surveyId}?sourcePageId=${pageId}`, '_blank')}
                    className="w-full h-12 rounded-2xl font-bold text-sm shadow-lg shadow-indigo-100"
                >
                    Start Survey
                </Button>
                {isInModal && (
                    <Button variant="ghost" onClick={onClose} className="rounded-xl font-bold h-10 px-6 text-sm">
                        Dismiss
                    </Button>
                )}
            </div>
        </div>
    );
}


// ─── Main Public Page Client ──────────────────────────────────────────────
export default function PublicPageClient({ slug }: { slug: string }) {
    const db = useFirestore();
    const [page, setPage] = useState<CampaignPage | null>(null);
    const [version, setVersion] = useState<CampaignPageVersion | null>(null);
    const [theme, setTheme] = useState<CampaignPageTheme | null>(null);
    const [loading, setLoading] = useState(true);

    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    const { modalState, setModalState, fireTrigger } = useTriggerEngine(page);
    const [receiptFormSuccess, setReceiptFormSuccess] = React.useState(false);
    const { interpolate } = usePersonalization(page);


    useEffect(() => {
        if (!db) return;
        const fetchPage = async () => {
            // Check for static fallback
            if (slug === 'subscription-payment') {
                setPage(SUBSCRIPTION_PAYMENT_DATA.page as any);
                setVersion(SUBSCRIPTION_PAYMENT_DATA.version as any);
                setLoading(false);
                return;
            }

            try {
                const pageQuery = query(collection(db, 'campaign_pages'), where('slug', '==', slug), where('status', '==', 'published'));
                const pageSnap = await getDocs(pageQuery);
                if (pageSnap.empty) {
                    setError('Page not found or is not published.');
                    return;
                }

                const pageData = pageSnap.docs[0].data() as CampaignPage;
                setPage(pageData);

                if (!pageData.publishedVersionId) {
                    setError('Page has no published version.');
                    return;
                }

                const versionSnap = await getDoc(doc(db, 'campaign_page_versions', pageData.publishedVersionId));
                if (!versionSnap.exists()) {
                    setError('Published content is missing.');
                    return;
                }

                setVersion(versionSnap.data() as CampaignPageVersion);

                // Fetch Theme if specified
                if (pageData.themeId) {
                    const themes = await getThemesAction(pageData.organizationId);
                    const selected = themes.find(t => t.id === pageData.themeId);
                    if (selected) setTheme(selected);
                }
            } catch (err: any) {

                setError(err.message || 'An error occurred.');
            } finally {
                setLoading(false);
            }
        };

        fetchPage();
    }, [slug, db]);

    // ─── Hydration & Triggers ──────────────────────────────────────────
    useEffect(() => {
        if (!page || !page.id) return;

        // 1. Analytics
        const trackView = async () => {
            const storageKey = `ss_pv_${page.id}`;
            if (!localStorage.getItem(storageKey)) {
                await recordPageViewAction(page.id, true);
                localStorage.setItem(storageKey, '1');
            } else {
                await recordPageViewAction(page.id, false);
            }
        };
        trackView();

        // 2. Custom Scripts, Fonts & Title Personalization
        const inject = () => {
            // Document Title Personalization
            if (page.seo.title) {
                document.title = interpolate(page.seo.title);
            }

            // Fonts
            const font = page.settings.themeOverrides?.typography?.primaryFont || 'Inter';

            if (font && !['Inter', 'Roboto'].includes(font)) {
                let fontLink = document.querySelector(`link[href*="family=${font.replace(' ', '+')}"]`);
                if (!fontLink) {
                    fontLink = document.createElement('link');
                    fontLink.setAttribute('rel', 'stylesheet');
                    fontLink.setAttribute('href', `https://fonts.googleapis.com/css2?family=${font.replace(' ', '+')}:wght@400;500;700;900&display=swap`);
                    document.head.appendChild(fontLink);
                }
            }

            // Head Script
            if (page.settings.customHead) {
                const head = document.createElement('div');
                head.innerHTML = page.settings.customHead;
                head.childNodes.forEach(node => {
                    if (node.nodeName === 'SCRIPT') {
                        const s = document.createElement('script');
                        Array.from((node as HTMLScriptElement).attributes).forEach(a => s.setAttribute(a.name, a.value));
                        s.innerHTML = (node as HTMLScriptElement).innerHTML;
                        document.head.appendChild(s);
                    } else if (node.nodeType === 1) document.head.appendChild(node.cloneNode(true));
                });
            }

            // Body Script
            if (page.settings.customBody) {
                const body = document.createElement('div');
                body.innerHTML = page.settings.customBody;
                body.childNodes.forEach(node => {
                    if (node.nodeName === 'SCRIPT') {
                        const s = document.createElement('script');
                        Array.from((node as HTMLScriptElement).attributes).forEach(a => s.setAttribute(a.name, a.value));
                        s.innerHTML = (node as HTMLScriptElement).innerHTML;
                        document.body.appendChild(s);
                    } else if (node.nodeType === 1) document.body.appendChild(node.cloneNode(true));
                });
            }
        };
        
        inject();

        // 3. Exit Intent Detection
        const onMouseLeave = (e: MouseEvent) => {
            if (e.clientY <= 0) fireTrigger('on_exit');
        };
        document.addEventListener('mouseleave', onMouseLeave);
        
        return () => document.removeEventListener('mouseleave', onMouseLeave);
    }, [page?.id, fireTrigger]);



    // ─── Theme Variable Injection ──────────────────────────────────────────
    const themeStyles = React.useMemo(() => {
        if (!page) return '';
        
        const colors = {
            primary: page.settings.themeOverrides?.primary || theme?.colors.primary || '#0f172a',
            secondary: page.settings.themeOverrides?.secondary || theme?.colors.secondary || '#64748b',
            background: page.settings.themeOverrides?.background || theme?.colors.background || '#ffffff',
            accent: page.settings.themeOverrides?.accent || theme?.colors.accent || '#3b82f6',
        };

        const radius = theme?.ui.borderRadius || '1.25rem';
        const primaryFont = page.settings.themeOverrides?.typography?.primaryFont || theme?.typography.bodyFont || 'Inter';
        const hFont = primaryFont;
        const bFont = primaryFont;

        return `
            :root {
                --primary: ${colors.primary};
                --secondary: ${colors.secondary};
                --page-bg: ${colors.background};
                --accent: ${colors.accent};
                --radius: ${radius};
                --font-heading: "${hFont}", sans-serif;
                --font-body: "${bFont}", sans-serif;
            }

            body { background-color: var(--page-bg); font-family: var(--font-body); }
            h1, h2, h3, h4, h5, h6 { font-family: var(--font-heading); }
            .bg-primary { background-color: var(--primary) !important; }
            .text-primary { color: var(--primary) !important; }
            .rounded-2xl { border-radius: var(--radius) !important; }
            .rounded-3xl { border-radius: calc(var(--radius) * 1.5) !important; }
            .shadow-primary\\/20 { --tw-shadow-color: color-mix(in srgb, var(--primary) 20%, transparent); shadow-color: var(--tw-shadow-color); }
        `;
    }, [page, theme]);

    if (loading) {
        return <div className="h-screen flex flex-col items-center justify-center bg-white"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    }

    if (error || !page || !version) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
                <SmartSappLogo className="h-10 mb-8" />
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">404 - Not Found</h1>
                <p className="text-muted-foreground font-medium max-w-sm">{error || "The page you are looking for doesn't exist."}</p>
            </div>
        );
    }



    return (
        <div className="min-h-screen flex flex-col bg-white relative">
            <style dangerouslySetInnerHTML={{ __html: themeStyles }} />
            {!page.seo.noIndex ? (
                <>
                    {/* Metadata is handled by Next.js generateMetadata or hoisted by React if in body, but we avoid script tags here */}
                    {/* We'll use a hidden div to avoid React warnings about title/meta in body if they contain certain characters */}
                    <div className="hidden">
                        <title>{interpolate(page.seo.title)}</title>
                        <meta name="description" content={interpolate(page.seo.description)} />
                    </div>
                </>
            ) : (
                <>
                    <meta name="robots" content="noindex, nofollow" />
                </>
            )}


            {page.settings.showHeader && (
                <header className="h-20 border-b flex items-center justify-between px-6 md:px-12 bg-white/80 backdrop-blur-md sticky top-0 z-50">
                     <SmartSappLogo className="h-8" />
                     <div className="flex items-center gap-4">
                        <span className="hidden md:inline text-sm font-bold text-slate-500">Just Made Payment?</span>
                        <Button 
                            variant="outline" 
                            size="sm"
                            className="rounded-full font-black px-6 border-2 border-primary/10 hover:border-primary hover:text-primary transition-all duration-300"
                            onClick={() => setModalState({ type: 'receipt_request' })}
                        >
                            Request Receipt
                        </Button>
                    </div>
                </header>
            )}

            <main className="flex-1 w-full relative">
                {version.structureJson.sections?.length > 0 ? (
                    version.structureJson.sections.map((section, idx) => (
                        <div key={section.id || idx} className={cn("w-full py-16 md:py-24", section.props?.background === 'default' ? 'bg-white' : 'bg-slate-50')}>
                            <div className="max-w-7xl mx-auto px-6 md:px-12 space-y-12">
                                {section.blocks?.map((block, bIdx) => (
                                    <div
                                        key={block.id || bIdx}
                                        className="w-full"
                                        onClick={() => fireTrigger('block_click', block.id)}
                                    >
                                        {block.type === 'hero' && (
                                            <div className="text-center space-y-6 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-6 duration-1000">
                                                {block.props.badge && (
                                                    <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-black tracking-widest uppercase mb-4 animate-in zoom-in duration-500">
                                                        {block.props.badge}
                                                    </div>
                                                )}
                                                {block.props.imageUrl && (
                                                    <div className="relative h-[300px] md:h-[450px] w-full rounded-[3rem] overflow-hidden mb-12 shadow-2xl ring-1 ring-black/5">
                                                        <img 
                                                            src={block.props.imageUrl} 
                                                            alt={block.props.title} 
                                                            className="w-full h-full object-cover"
                                                        />
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                                                    </div>
                                                )}
                                                <h1 className="text-4xl md:text-7xl font-black tracking-tighter text-slate-900 leading-[1.1] mb-6">
                                                    {interpolate(block.props.title)}
                                                </h1>
                                                {block.props.subtitle && (
                                                    <p className="text-xl md:text-2xl text-slate-500 font-medium leading-relaxed max-w-3xl mx-auto">
                                                        {interpolate(block.props.subtitle)}
                                                    </p>
                                                )}
                                            </div>
                                        )}


                                        {block.type === 'text' && (
                                            <div className="max-w-3xl mx-auto prose prose-slate">
                                                <div dangerouslySetInnerHTML={{ __html: interpolate(block.props.content || '<p>Enter your content...</p>') }} />
                                            </div>
                                        )}

                                        {block.type === 'cta' && (
                                            <div className="flex justify-center py-6">
                                                <Button 
                                                    variant={block.props.variant === 'secondary' ? 'outline' : 'default'}
                                                    className={cn(
                                                        "h-14 px-10 rounded-2xl font-black text-lg transition-all gap-3 active:scale-95",
                                                        block.props.variant === 'primary' || !block.props.variant ? "shadow-xl shadow-primary/20 hover:-translate-y-1" : "",
                                                        block.props.variant === 'glass' ? "bg-white/20 backdrop-blur-md border border-white/30 text-slate-900 shadow-xl" : "",
                                                        block.props.variant === 'glow' ? "shadow-[0_0_30px_rgba(var(--primary-rgb),0.3)] hover:shadow-[0_0_50px_rgba(var(--primary-rgb),0.5)] animate-pulse" : ""
                                                    )}
                                                    onClick={() => {
                                                        if (block.id === 'cta-1') {
                                                            setModalState({ type: 'receipt_request' });
                                                            return;
                                                        }
                                                        fireTrigger('block_click', block.id);
                                                        if (block.props.url) {
                                                            window.open(block.props.url, block.props.url.startsWith('http') ? '_blank' : '_self');
                                                        }
                                                    }}
                                                >
                                                    {block.props.label || 'Click Me'}
                                                    <ArrowRight className="h-5 w-5 font-black" />
                                                </Button>
                                            </div>
                                        )}

                                        {block.type === 'form' && block.props.formId && (
                                            <EmbeddedForm 
                                                formId={block.props.formId} 
                                                pageId={page.id} 
                                                blockId={block.id}
                                                onSuccess={() => fireTrigger('form_submitted', block.id)}
                                            />
                                        )}

                                        {block.type === 'html' && (
                                            <div className="w-full">
                                                {block.props.css && (
                                                    <style dangerouslySetInnerHTML={{ __html: block.props.css }} />
                                                )}
                                                <div dangerouslySetInnerHTML={{ __html: block.props.html || '' }} />
                                            </div>
                                        )}

                                        {block.type === 'survey' && block.props.surveyId && (
                                            <EmbeddedSurvey 
                                                surveyId={block.props.surveyId} 
                                                pageId={page.id}
                                            />
                                        )}

                                        {block.type === 'faq' && block.props.items && (
                                            <div className="space-y-4 max-w-2xl mx-auto py-12">
                                                {block.props.items.map((item: any) => (
                                                    <details key={item.id} className="group bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all duration-300 open:shadow-xl open:ring-1 open:ring-primary/10">
                                                        <summary className="flex items-center justify-between p-6 cursor-pointer font-bold list-none">
                                                            <span className="text-slate-900">{item.question}</span>
                                                            <div className="h-6 w-6 rounded-full bg-slate-50 flex items-center justify-center group-open:rotate-180 transition-transform">
                                                                <ArrowRight className="h-4 w-4 text-slate-400 rotate-90" />
                                                            </div>
                                                        </summary>
                                                        <div className="px-6 pb-6 text-slate-500 leading-relaxed animate-in fade-in slide-in-from-top-2 duration-300">
                                                            {item.answer}
                                                        </div>
                                                    </details>
                                                ))}
                                            </div>
                                        )}

                                        {block.type === 'agreement' && (
                                            <div className="max-w-md mx-auto p-12 bg-white rounded-[2.5rem] shadow-2xl ring-1 ring-black/5 text-center space-y-4">
                                                <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
                                                <h2 className="text-2xl font-bold">Sign Agreement</h2>
                                                <p className="text-sm text-muted-foreground">This content is currently under maintenance.</p>
                                            </div>
                                        )}
                                        
                                        {block.type === 'payment_methods' && block.props.methods && (
                                            <div className={cn(
                                                "grid gap-8 mx-auto",
                                                block.props.methods.length === 1 ? "grid-cols-1 max-w-2xl" : "grid-cols-1 md:grid-cols-2 max-w-6xl"
                                            )}>
                                                {block.props.methods.map((method: any, mIdx: number) => (
                                                    <PaymentMethodCard
                                                        key={mIdx}
                                                        type="bank"
                                                        title={method.title}
                                                        details={method.details}
                                                        backgroundColor={method.backgroundColor}
                                                        accentColor={method.accentColor}
                                                    />
                                                ))}
                                            </div>
                                        )}

                                        {block.type === 'procedure_list' && (
                                            <div className="max-w-3xl mx-auto">
                                                <PaymentMethodCard
                                                    type="procedure"
                                                    title={block.props.title}
                                                    steps={block.props.steps}
                                                    imageUrl={block.props.imageUrl}
                                                    backgroundColor={block.props.backgroundColor}
                                                    accentColor={block.props.accentColor}
                                                />
                                            </div>
                                        )}


                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-6">
                        <PlusSquare className="w-12 h-12 text-slate-200 mb-4" />
                        <h2 className="text-xl font-semibold text-slate-400">Empty Page</h2>
                        <p className="text-sm text-slate-400 mt-2">This page has no content published.</p>
                    </div>
                )}
            </main>

            {page.settings.showFooter && (
                <footer className="py-12 border-t text-center space-y-4 bg-slate-50 mt-auto">
                    <SmartSappLogo className="h-6 mx-auto opacity-50" />
                    <p className="text-xs font-semibold text-muted-foreground">
                        © {new Date().getFullYear()} SmartSapp Campaigns. All Rights Reserved.
                    </p>
                </footer>
            )}

            {/* ─── Global Modal Container (Trigger Engine) ─── */}
            <Dialog open={!!modalState} onOpenChange={(open) => !open && setModalState(null)}>
                <DialogContent className="sm:max-w-lg rounded-3xl p-8 border-0 shadow-2xl">
                    <DialogTitle className="sr-only">
                        {modalState?.type === 'form' ? 'Form' : modalState?.type === 'survey' ? 'Survey' : 'Document'}
                    </DialogTitle>
                    {modalState?.type === 'form' && (
                        <EmbeddedForm
                            formId={modalState.targetId}
                            pageId={page.id}
                            isInModal={true}
                            onSuccess={() => setModalState(null)}
                        />
                    )}
                    {modalState?.type === 'survey' && (
                        <EmbeddedSurvey 
                            surveyId={modalState.targetId} 
                            pageId={page.id}
                            onClose={() => setModalState(null)} 
                            isInModal={true} 
                        />
                    )}
                    {modalState?.type === 'receipt_request' && (
                        <div className="space-y-6 py-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {receiptFormSuccess ? (
                                <div className="text-center space-y-4 py-8">
                                    <div className="h-20 w-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                                        <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-slate-900">Request Sent!</h2>
                                    <p className="text-slate-500 font-medium">Your receipt request has been sent to Our Accounts Department. We will process it shortly.</p>
                                    <Button onClick={() => { setModalState(null); setReceiptFormSuccess(false); }} className="rounded-xl font-bold w-full h-12">Done</Button>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-1">
                                        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Request Receipt</h2>
                                        <p className="text-sm text-slate-500">Enter your details below to receive your payment receipt.</p>
                                    </div>
                                    <form 
                                        className="space-y-4"
                                        onSubmit={async (e) => {
                                            e.preventDefault();
                                            const formData = new FormData(e.currentTarget);
                                            const payload = Object.fromEntries(formData.entries());
                                            
                                            try {
                                                // Call automated notification flow (Email, SMS, Webhook)
                                                await sendReceiptAcknowledgementAction({
                                                    name: payload.name as string,
                                                    school: payload.school as string,
                                                    phone: payload.phone as string,
                                                    email: payload.email as string,
                                                    amount: payload.amount as string,
                                                });
                                            } catch (err) {
                                                console.error("Notification flow failed:", err);
                                            }
                                            
                                            setReceiptFormSuccess(true);
                                        }}
                                    >
                                        <div className="space-y-2">
                                            <Label className="text-sm font-semibold text-slate-700 ml-1">Your Name</Label>
                                            <Input name="name" required placeholder="John Doe" className="h-12 rounded-xl bg-slate-50 border-slate-200" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-sm font-semibold text-slate-700 ml-1">Name of School</Label>
                                            <Input name="school" required placeholder="Smart Academy" className="h-12 rounded-xl bg-slate-50 border-slate-200" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-sm font-semibold text-slate-700 ml-1">Phone Number</Label>
                                                <Input name="phone" required placeholder="024 XXX XXXX" className="h-12 rounded-xl bg-slate-50 border-slate-200" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-sm font-semibold text-slate-700 ml-1">Email</Label>
                                                <Input name="email" type="email" required placeholder="school@example.com" className="h-12 rounded-xl bg-slate-50 border-slate-200" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-sm font-semibold text-slate-700 ml-1">Payment Amount (GHS)</Label>
                                            <Input name="amount" type="number" required placeholder="0.00" className="h-12 rounded-xl bg-slate-50 border-slate-200" />
                                        </div>
                                        <Button type="submit" className="w-full h-14 rounded-2xl font-black text-base shadow-xl shadow-primary/20 mt-4">
                                            Send Request
                                        </Button>
                                    </form>
                                </>
                            )}
                        </div>
                    )}

                </DialogContent>
            </Dialog>
        </div>
    );
}
