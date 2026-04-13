'use client';

import * as React from 'react';
import { use, useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import type { CampaignPage, CampaignPageVersion } from '@/lib/types';
import { Loader2, PlusSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SmartSappLogo } from '@/components/icons';
import { cn } from '@/lib/utils';
import Head from 'next/head';

export default function PublicPageClient({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = use(params);
    const db = useFirestore();
    const [page, setPage] = useState<CampaignPage | null>(null);
    const [version, setVersion] = useState<CampaignPageVersion | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!db) return;
        const fetchPage = async () => {
            try {
                // 1. Fetch CampaignPage by Slug
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

                // 2. Fetch the specific published version
                const versionSnap = await getDoc(doc(db, 'campaign_page_versions', pageData.publishedVersionId));
                if (!versionSnap.exists()) {
                    setError('Published content is missing.');
                    return;
                }

                setVersion(versionSnap.data() as CampaignPageVersion);
            } catch (err: any) {
                setError(err.message || 'An error occurred.');
            } finally {
                setLoading(false);
            }
        };

        fetchPage();
    }, [slug, db]);

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
        <div className="min-h-screen flex flex-col bg-white">
            {!page.seo.noIndex ? (
                <head>
                    <title>{page.seo.title}</title>
                    <meta name="description" content={page.seo.description} />
                    {page.seo.ogImageUrl && <meta property="og:image" content={page.seo.ogImageUrl} />}
                </head>
            ) : (
                <head>
                    <meta name="robots" content="noindex, nofollow" />
                </head>
            )}

            {page.settings.showHeader && (
                <header className="h-16 border-b flex items-center px-6 md:px-12 bg-white sticky top-0 z-50">
                     <SmartSappLogo className="h-6" />
                </header>
            )}

            <main className="flex-1 w-full relative">
                {version.structureJson.sections?.length > 0 ? (
                    version.structureJson.sections.map((section, idx) => (
                        <div key={section.id || idx} className={cn("w-full py-16 md:py-24", section.props?.background === 'default' ? 'bg-white' : 'bg-slate-50')}>
                            <div className="max-w-7xl mx-auto px-6 md:px-12 space-y-12">
                                {section.blocks?.map((block, bIdx) => (
                                    <div key={block.id || bIdx} className="w-full">
                                        {block.type === 'hero' && (
                                            <div className="text-center space-y-6 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-6 duration-1000">
                                                <h1 className="text-4xl md:text-6xl font-bold tracking-tighter text-slate-900 leading-tight">
                                                    {block.props.title}
                                                </h1>
                                                <p className="text-lg md:text-xl text-muted-foreground">
                                                    {block.props.subtitle}
                                                </p>
                                            </div>
                                        )}
                                        {block.type === 'form' && (
                                            <div className="max-w-md mx-auto p-8 bg-white rounded-[2rem] shadow-xl ring-1 ring-black/5 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-150">
                                                <form className="space-y-6" onSubmit={e => e.preventDefault()}>
                                                    {block.props.fields?.map((f: any, fIdx: number) => (
                                                        <div key={fIdx} className="space-y-2 text-left">
                                                            <Label className="text-sm font-semibold ml-1">{f.label}</Label>
                                                            <Input 
                                                                type={f.type} 
                                                                required={f.required} 
                                                                placeholder={`Enter ${f.label.toLowerCase()}`} 
                                                                className="h-12 rounded-xl bg-slate-50 border-slate-200" 
                                                            />
                                                        </div>
                                                    ))}
                                                    <Button className="w-full h-12 rounded-xl font-bold text-sm shadow-lg hover:-translate-y-0.5 transition-transform">
                                                        {block.props.buttonText || 'Submit'}
                                                    </Button>
                                                </form>
                                                <p className="text-[10px] text-center text-muted-foreground mt-4 font-medium uppercase tracking-widest">
                                                    Powered by SmartSapp
                                                </p>
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
        </div>
    );
}
