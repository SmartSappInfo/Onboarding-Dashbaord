'use client';

import * as React from 'react';
import { use, useEffect, useState, useCallback, useRef } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import type { CampaignPage, CampaignPageVersion, PageTrigger, PageTriggerAction } from '@/lib/types';
import { Loader2, PlusSquare, X, CheckCircle2, ArrowRight, Banknote, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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
import Footer from '@/components/footer';
import SUBSCRIPTION_PAYMENT_DATA from './payment-guide-data.json';
import { sendReceiptAcknowledgementAction } from '@/lib/notification-actions';
import Link from 'next/link';
import VideoEmbed from '@/components/video-embed';
import Image from 'next/image';
import { VERSIONS_COLLECTION } from '@/lib/page-builder/constants';
import { sanitizeHtml, sanitizeCss } from '@/lib/page-builder/sanitize';
import { PageRenderer } from '@/components/page-builder/PageRenderer';
import { resolveTheme } from '@/lib/page-builder/resolve-theme';
import { migrateLegacyStructure } from '@/lib/page-builder/migrate';
import { parseStructure } from '@/lib/page-builder/schema';

// Render published pages through the generic registry-driven `PageRenderer`.
// Defaults ON now that the legacy migration has landed; set the env var to
// 'false' to fall back to the legacy body for a fast rollback.
const USE_PAGE_BUILDER_V2 = process.env.NEXT_PUBLIC_PAGE_BUILDER_V2 !== 'false';

// Static class strings so Tailwind's JIT compiler keeps them (dynamic
// `grid-cols-${n}` strings get purged from the production bundle).
const STATS_GRID_COLS: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
};



// ─── Trigger Execution Engine ─────────────────────────────────────────────
function useTriggerEngine(page: CampaignPage | null, orgBranding?: any) {
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
        if (!page && !orgBranding) return;
        const font = page?.settings?.themeOverrides?.typography?.primaryFont || orgBranding?.brandFontFamily || 'Inter';
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
    }, [page, orgBranding]);


    const fireTrigger = useCallback((event: PageTrigger['event'], blockId?: string) => {
        if (!page || !page.settings.triggers) return;
        const trigger = page.settings.triggers.find(t => t.event === event && (!blockId || t.targetBlockId === blockId));
        if (trigger) {
            if (trigger.config?.once && firedRef.current.has(trigger.id)) return;
            executeActions(trigger.actions);
            firedRef.current.add(trigger.id);
        }
    }, [page, executeActions]);

    return { modalState, setModalState, fireTrigger };
}


// ─── Component: EmbeddedForm ──────────────────────────────────────────────
function EmbeddedForm({ formId, pageId, organizationId, workspaceId, isInModal, onSuccess }: { formId: string, pageId: string, organizationId: string, workspaceId: string, isInModal?: boolean, onSuccess?: () => void }) {
    const db = useFirestore();
    const [form, setForm] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitted, setSubmitted] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        const fetchForm = async () => {
            const docRef = doc(db, 'standaloneForms', formId);
            const snap = await getDoc(docRef);
            if (snap.exists()) setForm(snap.data());
            setLoading(false);
        };
        fetchForm();
    }, [db, formId]);

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>;
    if (!form) return <div className="text-center p-12 text-slate-400">Form not found</div>;

    if (submitted) {
        return (
            <div className="text-center p-12 space-y-4 animate-in fade-in zoom-in duration-500">
                <div className="h-20 w-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">{form.settings?.successMessage || 'Thank you!'}</h2>
                <p className="text-slate-500 dark:text-slate-400 font-medium">Your response has been recorded successfully.</p>
                {isInModal && (
                    <Button onClick={onSuccess} className="rounded-xl font-bold w-full h-12 mt-4">Close Window</Button>
                )}
            </div>
        );
    }

    return (
        <form 
            className="space-y-6"
            onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const data = Object.fromEntries(formData.entries());
                const res = await submitStandaloneFormAction(formId, data, workspaceId, organizationId, { sourcePageId: pageId });
                if (res.success) {
                    setSubmitted(true);
                    if (!isInModal && form.settings?.redirectUrl) {
                        setTimeout(() => window.location.href = form.settings.redirectUrl!, 2000);
                    }
                } else {
                    toast({ title: 'Error', description: res.error, variant: 'destructive' });
                }
            }}
        >
            <div className="space-y-1 mb-6">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">{form.title}</h2>
                {form.description && <p className="text-sm text-slate-500 dark:text-slate-400">{form.description}</p>}
            </div>

            <div className="space-y-4">
                {form.fields.map((field: any) => (
                    <div key={field.id} className="space-y-2">
                        <Label className="text-sm font-semibold text-slate-700 dark:text-slate-350 ml-1">{field.label}{field.required && '*'}</Label>
                        {field.type === 'textarea' ? (
                            <textarea 
                                name={field.id} 
                                required={field.required}
                                placeholder={field.placeholder}
                                className="w-full min-h-[100px] p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary/20 transition-all text-sm outline-none"
                            />
                        ) : (
                            <Input 
                                name={field.id} 
                                type={field.type} 
                                required={field.required}
                                placeholder={field.placeholder}
                                className="h-12 rounded-xl bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-slate-100"
                            />
                        )}
                    </div>
                ))}
            </div>

            <Button type="submit" className="w-full h-14 rounded-2xl font-black text-base shadow-xl shadow-primary/20 mt-4 transition-all hover:scale-[1.02] active:scale-95">
                {form.settings?.submitButtonLabel || 'Submit'}
            </Button>
        </form>
    );
}

// ─── Component: EmbeddedSurvey ────────────────────────────────────────────
function EmbeddedSurvey({ surveyId, pageId, onClose, isInModal }: { surveyId: string, pageId: string, onClose?: () => void, isInModal?: boolean }) {
    // For now, we'll redirect to the standalone survey page or show a placeholder
    // In a real app, this would be a multi-step form
    return (
        <div className="text-center p-12 space-y-6">
            <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto text-primary">
                <PlusSquare className="h-8 w-8" />
            </div>
            <div className="space-y-2">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Survey Required</h2>
                <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">To proceed, please complete our brief onboarding survey. This helps us tailor the experience for your institution.</p>
            </div>
            <Button 
                onClick={() => window.open(`/s/${surveyId}?ref=${pageId}`, '_blank')}
                className="w-full h-14 rounded-2xl font-bold text-lg shadow-xl shadow-primary/20"
            >
                Start Survey
                <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            {isInModal && (
                <button onClick={onClose} className="text-slate-400 dark:text-slate-500 font-bold text-sm hover:text-slate-600 dark:hover:text-slate-350 transition-colors">Maybe Later</button>
            )}
        </div>
    );
}


// ─── Main Client Component ───────────────────────────────────────────────
export default function PublicPageClient({ 
    slug,
    initialPage = null,
    initialVersion = null,
    orgBranding = null
}: { 
    slug: string;
    initialPage?: CampaignPage | null;
    initialVersion?: CampaignPageVersion | null;
    orgBranding?: {
        logoUrl: string;
        brandPrimaryColor: string;
        brandSecondaryColor: string;
        brandFontFamily: string;
        name: string;
    } | null;
}) {
    const db = useFirestore();
    const searchParams = useSearchParams();
    const [page, setPage] = useState<CampaignPage | null>(initialPage);
    const [version, setVersion] = useState<CampaignPageVersion | null>(initialVersion);
    const [loading, setLoading] = useState(!initialPage);
    const [receiptFormSuccess, setReceiptFormSuccess] = useState(false);
    const { modalState, setModalState, fireTrigger } = useTriggerEngine(page, orgBranding);

    useEffect(() => {
        if (page) return; // Skip client-side fetch if resolved server-side

        const fetchPage = async () => {
            // Check for static fallback
            if (slug === 'subscription-payment') {
                const data = SUBSCRIPTION_PAYMENT_DATA as any;
                setPage({ ...data.page, settings: { ...data.page.settings, showHeader: true, showFooter: true } });
                setVersion(data.version as any);
                setLoading(false);
                return;
            }

            try {
                const q = query(collection(db, 'campaign_pages'), where('slug', '==', slug));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    const pageData = { id: snap.docs[0].id, ...snap.docs[0].data() } as CampaignPage;
                    setPage(pageData);
                    
                    // Fetch published version from the top-level collection the
                    // builder actually writes to (see VERSIONS_COLLECTION).
                    if (pageData.publishedVersionId) {
                        const vRef = doc(db, VERSIONS_COLLECTION, pageData.publishedVersionId);
                        const vSnap = await getDoc(vRef);
                        if (vSnap.exists()) {
                            setVersion({ id: vSnap.id, ...vSnap.data() } as CampaignPageVersion);
                        }
                    }
                }
            } catch (err) {
                console.error('Error fetching page:', err);
            }
            setLoading(false);
        };
        fetchPage();
    }, [db, slug, page]);

    useEffect(() => {
        if (page) {
            // Simple session-based uniqueness check
            const sessionKey = `v_pg_${page.id}`;
            const isUnique = !sessionStorage.getItem(sessionKey);
            if (isUnique) sessionStorage.setItem(sessionKey, 'true');

            recordPageViewAction(page.id, isUnique);
            fireTrigger('page_load');
        }
    }, [page, fireTrigger]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#09090b]">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-12 w-12 text-primary animate-spin" />
                    <p className="text-slate-400 dark:text-slate-500 font-bold animate-pulse">Loading secure gateway...</p>
                </div>
            </div>
        );
    }

    if (!page || !version) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#09090b]">
                <div className="text-center space-y-6">
                    <div className="h-24 w-24 bg-slate-100 dark:bg-zinc-900 rounded-[2rem] flex items-center justify-center mx-auto text-slate-300 dark:text-zinc-700">
                        <X className="h-12 w-12" />
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-3xl font-black text-slate-900 dark:text-slate-50">404 - Not Found</h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium">The page you are looking for does not exist or has been moved.</p>
                    </div>
                    <Button asChild className="rounded-xl px-8 h-12">
                        <Link href="/">Go Home</Link>
                    </Button>
                </div>
            </div>
        );
    }

    const primaryColor = page?.settings?.themeOverrides?.primary || orgBranding?.brandPrimaryColor || '#3b82f6';
    const secondaryColor = orgBranding?.brandSecondaryColor || '#8b5cf6';
    const brandFont = orgBranding?.brandFontFamily || 'Inter';

    const resolvedTheme = resolveTheme({
        overrides: page.settings.themeOverrides,
        branding: orgBranding
            ? {
                  brandPrimaryColor: orgBranding.brandPrimaryColor,
                  brandSecondaryColor: orgBranding.brandSecondaryColor,
                  brandFontFamily: orgBranding.brandFontFamily,
              }
            : null,
    });

    const themeStyles = `
        :root {
            --primary: ${primaryColor};
            --secondary: ${secondaryColor};
            --primary-foreground: #ffffff;
            --radius: 1rem;
            transition: --primary 300ms, --secondary 300ms;
        }
        body {
            font-family: ${brandFont}, var(--font-body, Inter), sans-serif;
        }
    `;

    const interpolate = (text: string) => {
        if (!text) return '';
        let result = text;
        searchParams.forEach((value, key) => {
            result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
        });
        return result;
    };

    return (
        <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#09090b] transition-colors duration-500 relative overflow-x-hidden font-body">
            <style dangerouslySetInnerHTML={{ __html: themeStyles }} />
            
            {/* Background Ambient Glow */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-[10%] -right-[10%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full" />
                <div className="absolute -bottom-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full" />
            </div>

            {page?.settings?.showHeader && (
                <header className="fixed top-0 z-50 w-full py-4">
                    <div className="container max-w-4xl mx-auto px-6">
                        <div className="flex items-center justify-between rounded-full bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md border border-border/50 dark:border-zinc-800 py-1.5 px-6 shadow-lg shadow-black/5 dark:shadow-black/20 transition-all">
                            <div className="flex items-center gap-4">
                                {orgBranding?.logoUrl ? (
                                    <Image
                                        src={orgBranding.logoUrl}
                                        alt={`${orgBranding.name || 'Organization'} logo`}
                                        width={120}
                                        height={32}
                                        className="h-8 w-auto object-contain animate-none"
                                        unoptimized={orgBranding.logoUrl.startsWith('http')}
                                    />
                                ) : (
                                    <SmartSappLogo className="h-8 w-auto" />
                                )}
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="hidden md:block text-xs font-bold text-slate-500 dark:text-slate-400">Done Paying?</span>
                                <Button 
                                    variant="default"
                                    className="h-10 px-6 rounded-full font-bold text-xs shadow-md shadow-blue-500/20 transition-all active:scale-95 bg-blue-600 hover:bg-blue-700 text-white"
                                    onClick={() => setModalState({ type: 'receipt_request' })}
                                >
                                    Request Receipt
                                </Button>
                            </div>
                        </div>
                    </div>
                </header>
            )}

            {/* SEO/social metadata is handled server-side in generateMetadata. */}

            <main className="flex-1 w-full relative">
                {USE_PAGE_BUILDER_V2 ? (
                    <div className="container max-w-4xl mx-auto px-6 pt-32 pb-24 font-body">
                        <PageRenderer
                            page={page}
                            version={{ ...version, structureJson: migrateLegacyStructure(parseStructure(version.structureJson)) }}
                            theme={resolvedTheme}
                            interpolate={interpolate}
                            fireTrigger={(event, blockId) => {
                                // Legacy shim: the static payment page's receipt CTA opens a
                                // bespoke modal hosted here rather than a generic action.
                                if (event === 'block_click' && blockId === 'cta-1') {
                                    setModalState({ type: 'receipt_request' });
                                    return;
                                }
                                fireTrigger(event as PageTrigger['event'], blockId);
                            }}
                        />
                    </div>
                ) : (
                <>
                {/* Hero Section (Always Outside Card) */}
                <div className="container max-w-4xl mx-auto px-6 pt-32 mb-12 text-center space-y-3 font-body">
                    {version.structureJson.sections?.find(s => s.id === 'hero-section')?.blocks.map((block, bIdx) => (
                        <div key={bIdx}>
                            {block.type === 'hero' && (
                                <div className="space-y-4">
                                    {block.props.title?.includes(' - ') ? (
                                        <>
                                            <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold mb-2 animate-in zoom-in duration-500">
                                                {block.props.title.split(' - ')[0]}
                                            </div>
                                            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-slate-50 leading-tight font-headline">
                                                {interpolate(block.props.title.split(' - ')[1])}
                                            </h1>
                                        </>
                                    ) : (
                                        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-slate-50 leading-tight font-headline">
                                            {interpolate(block.props.title)}
                                        </h1>
                                    )}
                                    {block.props.subtitle && (
                                        <p className="text-slate-500 dark:text-slate-400 font-medium text-base max-w-2xl mx-auto leading-relaxed">
                                            {interpolate(block.props.subtitle)}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Main Content Card */}
                <div className="container max-w-4xl mx-auto px-6 pb-24 font-body">
                    <Card className="rounded-2xl border border-border/50 dark:border-zinc-800 shadow-sm overflow-hidden bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm">
                        <CardContent className="p-0">
                            {version.structureJson.sections?.filter(s => s.id !== 'hero-section').map((section, idx) => (
                                <div key={section.id}>
                                    {idx > 0 && <Separator className="bg-border/50 dark:bg-zinc-800/50" />}
                                    <div className="p-8 md:p-10 space-y-8">
                                        {/* Section Heading */}
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm shadow-blue-500/5">
                                                {section.id === 'payment-methods-section' ? <Banknote className="w-5 h-5" /> : 
                                                 section.id === 'procedure-section' ? <Smartphone className="w-5 h-5" /> : 
                                                 <CheckCircle2 className="w-5 h-5" />}
                                            </div>
                                            <h3 className="text-lg font-bold tracking-tight text-[#0F172A] dark:text-slate-100 font-headline">
                                                {section.id === 'payment-methods-section' ? 'Bank Details' : 
                                                 section.id === 'procedure-section' ? 'Payment Procedure' : 
                                                 'Complete Payment'}
                                            </h3>
                                        </div>

                                        <div className="space-y-6">
                                            {section.blocks.map((block, bIdx) => (
                                                <div key={bIdx} className="animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ animationDelay: `${bIdx * 100}ms` }}>
                                                    {block.type === 'payment_methods' && (
                                                        <div className="grid grid-cols-1 gap-6">
                                                            {block.props.methods?.map((method: any, mIdx: number) => (
                                                                <div key={mIdx} className="p-8 rounded-2xl bg-slate-50/50 dark:bg-zinc-900/30 border border-border/20 dark:border-zinc-800/50 space-y-6 hover:bg-white hover:dark:bg-zinc-900/60 hover:shadow-md transition-all duration-300">
                                                                    <div className="flex items-center gap-4">
                                                                        <div className="w-12 h-12 rounded-xl bg-white dark:bg-zinc-800 shadow-sm flex items-center justify-center border border-border/10 dark:border-zinc-700">
                                                                            <img src={method.icon || 'https://cdn-icons-png.flaticon.com/512/2830/2830284.png'} alt={method.name} className="w-8 h-8 object-contain" />
                                                                        </div>
                                                                        <span className="font-bold text-slate-800 dark:text-slate-100 text-lg tracking-tight">{method.name || method.title}</span>
                                                                    </div>
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                                        {method.details.map((detail: any, dIdx: number) => (
                                                                            <div key={dIdx} className="flex flex-col space-y-1">
                                                                                <span className="text-[10px] font-bold text-muted-foreground/60 dark:text-slate-500/80 uppercase tracking-widest">{detail.label}</span>
                                                                                <span className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">{detail.value}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {block.type === 'procedure_list' && (
                                                        <div className="space-y-6">
                                                            {block.props.imageUrl && (
                                                                <div className="rounded-2xl overflow-hidden border border-border/20 dark:border-zinc-800/50 shadow-inner bg-slate-100 dark:bg-zinc-900">
                                                                    <img src={block.props.imageUrl} alt={block.props.title} className="w-full h-auto" />
                                                                </div>
                                                            )}
                                                            <ul className="grid grid-cols-1 gap-3">
                                                                {block.props.steps?.map((step: any, sIdx: number) => (
                                                                    <li key={sIdx} className="flex items-start gap-4 p-5 rounded-xl bg-slate-50/50 dark:bg-zinc-900/30 border border-border/20 dark:border-zinc-800/50">
                                                                        <div className="mt-1 flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                                            <span className="text-sm font-bold text-primary">{sIdx + 1}</span>
                                                                        </div>
                                                                        <p className="text-lg font-medium leading-relaxed text-slate-700 dark:text-slate-300" dangerouslySetInnerHTML={{ __html: step }} />
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}

                                                    {block.type === 'text' && (
                                                        <div className="prose prose-slate dark:prose-invert max-w-none text-slate-600 dark:text-slate-300 font-medium" dangerouslySetInnerHTML={{ __html: interpolate(block.props.content) }} />
                                                    )}

                                                    {block.type === 'cta' && (
                                                        <div className="flex justify-center pt-4">
                                                            <Button 
                                                                variant="default"
                                                                className="h-14 px-16 rounded-xl font-bold text-sm shadow-xl shadow-blue-500/20 transition-all gap-3 active:scale-95 bg-blue-600 hover:bg-blue-700 text-white"
                                                                onClick={() => {
                                                                    if (block.id === 'cta-1') setModalState({ type: 'receipt_request' });
                                                                    else if (block.props.url) window.open(block.props.url, '_blank');
                                                                }}
                                                            >
                                                                {block.props.label || 'Continue'}
                                                                <ArrowRight className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    )}

                                                    {block.type === 'image' && block.props.src && (
                                                        <div className="rounded-2xl overflow-hidden border border-border/20 shadow-sm">
                                                            <img src={block.props.src} alt={block.props.alt || ''} className="w-full h-auto" loading="lazy" />
                                                            {block.props.caption && (
                                                                <p className="text-xs text-slate-500 text-center py-3 italic bg-slate-50/50">{interpolate(block.props.caption)}</p>
                                                            )}
                                                        </div>
                                                    )}

                                                    {block.type === 'video' && block.props.url && (
                                                        <div className="rounded-2xl overflow-hidden border border-border/20 shadow-sm aspect-video bg-black group relative">
                                                            <VideoEmbed url={block.props.url} thumbnailUrl={block.props.thumbnailUrl} />
                                                        </div>
                                                    )}

                                                    {block.type === 'spacer' && (
                                                        <div style={{ height: block.props.height || 48 }} />
                                                    )}

                                                    {block.type === 'divider' && (
                                                        <div className="py-2">
                                                            {block.props.style === 'gradient' ? (
                                                                <div className="h-px bg-gradient-to-r from-transparent via-slate-300 dark:via-zinc-800 to-transparent" />
                                                            ) : (
                                                                <hr className={cn(
                                                                    "border-t border-border dark:border-zinc-800",
                                                                    block.props.style === 'dashed' && "border-dashed",
                                                                    block.props.style === 'dotted' && "border-dotted"
                                                                )} style={block.props.color ? { borderColor: block.props.color } : {}} />
                                                            )}
                                                        </div>
                                                    )}

                                                    {block.type === 'faq' && block.props.items?.length > 0 && (
                                                        <div className="space-y-3">
                                                            {block.props.items.map((item: any) => (
                                                                <details key={item.id} className="group rounded-xl border border-border/30 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/30 overflow-hidden">
                                                                    <summary className="flex items-center justify-between p-5 cursor-pointer select-none font-bold text-sm text-slate-800 dark:text-slate-200 hover:bg-white hover:dark:bg-zinc-900 transition-colors">
                                                                        {item.question}
                                                                        <span className="ml-2 text-slate-400 group-open:rotate-180 transition-transform duration-200">▾</span>
                                                                    </summary>
                                                                    <div className="px-5 pb-5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed border-t border-border/20 dark:border-zinc-800/30 pt-3">
                                                                        {item.answer}
                                                                    </div>
                                                                </details>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {block.type === 'testimonial' && (
                                                        <div className="max-w-lg mx-auto p-8 bg-slate-50/50 dark:bg-zinc-900/30 rounded-2xl border border-border/20 dark:border-zinc-800/50 text-center space-y-4">
                                                            <div className="text-4xl text-slate-200 dark:text-zinc-800">"</div>
                                                            <p className="text-base italic text-slate-600 dark:text-slate-300 leading-relaxed font-medium">{interpolate(block.props.quote || '')}</p>
                                                            <div className="flex items-center justify-center gap-3 pt-2">
                                                                {block.props.avatarUrl && (
                                                                    <img src={block.props.avatarUrl} alt={block.props.author} className="w-10 h-10 rounded-full object-cover border-2 border-white dark:border-zinc-800 shadow-sm" />
                                                                )}
                                                                <div className="text-left">
                                                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{block.props.author || 'Author'}</p>
                                                                    {block.props.role && <p className="text-xs text-slate-500 dark:text-slate-400">{block.props.role}</p>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {block.type === 'stats' && block.props.items?.length > 0 && (
                                                        <div className={cn("grid gap-6 text-center", STATS_GRID_COLS[block.props.items.length] ?? "grid-cols-2 md:grid-cols-4")}>
                                                            {block.props.items.map((item: any) => (
                                                                <div key={item.id} className="p-6 bg-slate-50/50 dark:bg-zinc-900/30 rounded-2xl border border-border/20 dark:border-zinc-800/50">
                                                                    <p className="text-3xl font-black text-primary tracking-tight">{item.value}</p>
                                                                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-2">{item.label}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {block.type === 'html' && page.settings.customScriptsAllowed && block.props.html && (
                                                        <>
                                                            {block.props.css && <style dangerouslySetInnerHTML={{ __html: sanitizeCss(String(block.props.css)) }} />}
                                                            <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(String(block.props.html)) }} />
                                                        </>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
                </>
                )}
            </main>

            {/* ─── Global Modal Container (Trigger Engine) ─── */}
            <Dialog open={!!modalState} onOpenChange={(open) => !open && setModalState(null)}>
                <DialogContent className="sm:max-w-lg rounded-3xl p-8 border-0 shadow-2xl font-body">
                    <DialogTitle className="sr-only">
                        {modalState?.type === 'form' ? 'Form' : modalState?.type === 'survey' ? 'Survey' : 'Document'}
                    </DialogTitle>
                    {modalState?.type === 'form' && page && (
                        <EmbeddedForm
                            formId={modalState.targetId}
                            pageId={page.id}
                            organizationId={page.organizationId}
                            workspaceId={page.workspaceIds[0]}
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
                                    <div className="h-20 w-20 bg-emerald-100 dark:bg-emerald-950/30 rounded-full flex items-center justify-center mx-auto">
                                        <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50 font-headline">Request Sent!</h2>
                                    <p className="text-slate-500 dark:text-slate-400 font-medium">Your receipt request has been sent to Our Accounts Department. We will process it shortly.</p>
                                    <Button onClick={() => { setModalState(null); setReceiptFormSuccess(false); }} className="rounded-xl font-bold w-full h-12">Done</Button>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-1">
                                        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 font-headline">Request Receipt</h2>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Enter your details below to receive your payment receipt.</p>
                                    </div>
                                    <form 
                                        className="space-y-4"
                                        onSubmit={async (e) => {
                                            e.preventDefault();
                                            const formData = new FormData(e.currentTarget);
                                            const payload = Object.fromEntries(formData.entries());
                                            
                                            try {
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
                                            <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Your Name</Label>
                                            <Input name="name" required placeholder="John Doe" className="h-12 rounded-xl bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 dark:text-slate-100" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Name of School</Label>
                                            <Input name="school" required placeholder="Smart Academy" className="h-12 rounded-xl bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 dark:text-slate-100" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Phone Number</Label>
                                                <Input name="phone" required placeholder="024 XXX XXXX" className="h-12 rounded-xl bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 dark:text-slate-100" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Email</Label>
                                                <Input name="email" type="email" required placeholder="school@example.com" className="h-12 rounded-xl bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 dark:text-slate-100" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Payment Amount (GHS)</Label>
                                            <Input name="amount" type="number" required placeholder="0.00" className="h-12 rounded-xl bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 dark:text-slate-100" />
                                        </div>
                                        <Button type="submit" className="w-full h-14 rounded-2xl font-black text-base shadow-xl shadow-blue-500/20 mt-4 bg-blue-600 hover:bg-blue-700 text-white">
                                            Send Request
                                        </Button>
                                    </form>
                                </>
                            )}
                        </div>
                    )}

                </DialogContent>
            </Dialog>

            {page?.settings?.showFooter && <Footer />}
        </div>
    );
}
