'use client';

import * as React from 'react';
import { use, useState, useEffect } from 'react';
import { collection, query, doc, getDoc, updateDoc, setDoc, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/context/TenantContext';
import { 
    Layout, 
    ArrowLeft, 
    Loader2, 
    MonitorPlay, 
    Smartphone, 
    Globe, 
    Save, 
    Send,
    Type,
    Image as ImageIcon,
    PlusSquare,
    MousePointer2,
    Settings2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CampaignPage, CampaignPageVersion, CampaignPageStructure, PageSection } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

// Simple Builder Component Shell
export default function BuilderClient({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();
    const { user } = useUser();
    
    const [page, setPage] = useState<CampaignPage | null>(null);
    const [version, setVersion] = useState<CampaignPageVersion | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [activeTab, setActiveTab] = useState<'add' | 'edit'>('add');
    const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');

    useEffect(() => {
        if (!firestore) return;

        const loadData = async () => {
            try {
                // Fetch Page
                const pageSnap = await getDoc(doc(firestore, 'campaign_pages', id));
                if (!pageSnap.exists()) throw new Error('Page not found');
                const pageData = pageSnap.data() as CampaignPage;
                setPage(pageData);

                // Fetch latest drafting version
                const vQuery = query(
                    collection(firestore, 'campaign_page_versions'),
                    where('pageId', '==', id),
                    orderBy('versionNumber', 'desc'),
                    limit(1)
                );
                const vSnap = await getDocs(vQuery);
                
                if (!vSnap.empty) {
                    setVersion(vSnap.docs[0].data() as CampaignPageVersion);
                } else {
                    throw new Error('No structure found for this page.');
                }
            } catch (err: any) {
                toast({ variant: 'destructive', title: 'Error loading page', description: err.message });
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [firestore, id, toast]);

    const handleSaveAsDraft = async () => {
        if (!firestore || !version) return;
        setSaving(true);
        try {
            await updateDoc(doc(firestore, 'campaign_page_versions', version.id), {
                structureJson: version.structureJson,
                updatedAt: new Date().toISOString()
            });
            toast({ title: 'Draft Saved', description: 'Your progress has been saved.' });
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Save failed', description: err.message });
        } finally {
            setSaving(false);
        }
    };

    const handlePublish = async () => {
        if (!firestore || !page || !version || !user) return;
        setPublishing(true);
        try {
            const timestamp = new Date().toISOString();
            
            // 1. Create a "published" snapshot version
            const newVersionNum = version.versionNumber + 1;
            const newVersionId = doc(collection(firestore, 'campaign_page_versions')).id;
            
            const publishedVersion: CampaignPageVersion = {
                id: newVersionId,
                pageId: id,
                organizationId: page.organizationId,
                versionNumber: newVersionNum,
                structureJson: version.structureJson,
                createdBy: user.uid,
                createdAt: timestamp,
                isPublishedVersion: true
            };

            await setDoc(doc(firestore, 'campaign_page_versions', newVersionId), publishedVersion);

            // 2. Update Page document to status = published && point to this new version
            await updateDoc(doc(firestore, 'campaign_pages', id), {
                status: 'published',
                publishedVersionId: newVersionId,
                updatedAt: timestamp
            });

            setPage(prev => prev ? { ...prev, status: 'published', publishedVersionId: newVersionId } : prev);
            
            toast({ 
                title: 'Page Published!', 
                description: 'The page is now live and public.',
                variant: 'default',
            });
            
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Publish failed', description: err.message });
        } finally {
            setPublishing(false);
        }
    };

    if (loading) {
        return <div className="h-screen bg-muted/20 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    }

    if (!page || !version) return <div className="p-8 text-center">Error: Page data incomplete</div>;

    return (
        <div className="flex flex-col h-screen bg-slate-50 text-slate-900 border-t print:hidden">
            {/* Header */}
            <header className="h-16 flex items-center justify-between px-6 bg-white border-b shrink-0 z-10 shadow-sm">
                <div className="flex items-center gap-4">
                    <Button asChild variant="ghost" className="h-9 w-9 p-0 rounded-lg hover:bg-slate-100">
                        <Link href="/admin/pages"><ArrowLeft className="h-4 w-4" /></Link>
                    </Button>
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold tracking-tight">{page.name}</span>
                        <span className="text-[10px] text-slate-500 font-medium">/{page.slug}</span>
                    </div>
                    {page.status === 'published' && (
                        <div className="ml-2 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[9px] font-bold uppercase tracking-wider">
                            Live
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setViewport('desktop')}
                        className={cn("h-8 px-3 rounded-lg text-xs font-semibold gap-2", viewport === 'desktop' ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-900")}
                    >
                        <MonitorPlay className="w-4 h-4" /> PC
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setViewport('mobile')}
                        className={cn("h-8 px-3 rounded-lg text-xs font-semibold gap-2", viewport === 'mobile' ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-900")}
                    >
                        <Smartphone className="w-4 h-4" /> Mobile
                    </Button>
                </div>

                <div className="flex items-center gap-3">
                    {page.status === 'published' && (
                        <Button asChild variant="ghost" className="h-9 font-semibold text-xs border border-border">
                            <a href={`/p/${page.slug}`} target="_blank" rel="noopener noreferrer">
                                <Globe className="w-3.5 h-3.5 mr-1.5" /> View Live
                            </a>
                        </Button>
                    )}
                    <Button 
                        variant="outline" 
                        disabled={saving}
                        onClick={handleSaveAsDraft}
                        className="h-9 font-semibold text-xs min-w-[90px]"
                    >
                        {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                        Save Draft
                    </Button>
                    <Button 
                        onClick={handlePublish}
                        disabled={publishing}
                        className="h-9 font-bold bg-primary hover:bg-primary/90 text-xs shadow-md shadow-primary/20 min-w-[100px]"
                    >
                        {publishing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
                        Publish
                    </Button>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Left Panel: Blocks */}
                <aside className="w-80 bg-white border-r flex flex-col shrink-0 z-10 shadow-sm relative">
                    <div className="flex items-center gap-1 p-2 border-b bg-slate-50/50">
                        <Button 
                            variant="ghost" 
                            className={cn("flex-1 h-9 rounded-lg text-[11px] font-semibold", activeTab === 'add' ? "bg-white shadow-sm text-primary" : "text-slate-600")}
                            onClick={() => setActiveTab('add')}
                        >
                            <PlusSquare className="w-4 h-4 mr-2" /> Add Block
                        </Button>
                        <Button 
                            variant="ghost" 
                            className={cn("flex-1 h-9 rounded-lg text-[11px] font-semibold", activeTab === 'edit' ? "bg-white shadow-sm text-primary" : "text-slate-600")}
                            onClick={() => setActiveTab('edit')}
                        >
                            <Settings2 className="w-4 h-4 mr-2" /> Properties
                        </Button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 placeholder-text">
                        {activeTab === 'add' ? (
                            <div className="space-y-6">
                                <section>
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Layouts</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex items-center justify-center flex-col gap-2 cursor-grab hover:border-primary/40 hover:bg-white transition-colors">
                                            <Layout className="w-5 h-5 text-slate-400" />
                                            <span className="text-[10px] font-semibold text-slate-600">Container</span>
                                        </div>
                                        <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex items-center justify-center flex-col gap-2 cursor-grab hover:border-primary/40 hover:bg-white transition-colors">
                                            <div className="flex gap-1"><div className="w-2 h-4 bg-slate-400 rounded-sm"/><div className="w-2 h-4 bg-slate-400 rounded-sm"/></div>
                                            <span className="text-[10px] font-semibold text-slate-600">Columns</span>
                                        </div>
                                    </div>
                                </section>
                                <section>
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Content</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex items-center justify-center flex-col gap-2 cursor-grab hover:border-primary/40 hover:bg-white transition-colors">
                                            <Type className="w-5 h-5 text-slate-400" />
                                            <span className="text-[10px] font-semibold text-slate-600">Typography</span>
                                        </div>
                                        <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex items-center justify-center flex-col gap-2 cursor-grab hover:border-primary/40 hover:bg-white transition-colors">
                                            <ImageIcon className="w-5 h-5 text-slate-400" />
                                            <span className="text-[10px] font-semibold text-slate-600">Image</span>
                                        </div>
                                        <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex items-center justify-center flex-col gap-2 cursor-grab hover:border-primary/40 hover:bg-white transition-colors">
                                            <MousePointer2 className="w-5 h-5 text-slate-400" />
                                            <span className="text-[10px] font-semibold text-slate-600">Button</span>
                                        </div>
                                        <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex items-center justify-center flex-col gap-2 cursor-grab hover:border-primary/40 hover:bg-white transition-colors col-span-2">
                                            <div className="h-6 w-16 bg-blue-500 rounded text-[6px] text-white flex items-center justify-center font-bold">Submit</div>
                                            <span className="text-[10px] font-semibold text-slate-600">Form Collection</span>
                                        </div>
                                    </div>
                                </section>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-60">
                                <Settings2 className="w-8 h-8 text-slate-400" />
                                <div>
                                    <p className="text-sm font-semibold">No block selected</p>
                                    <p className="text-[10px] text-slate-500 mt-1">Select a block on the canvas to edit its properties.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </aside>

                {/* Center Canvas */}
                <main className="flex-1 overflow-y-auto bg-slate-100/50 p-6 flex justify-center custom-scrollbar">
                    <div 
                        className={cn(
                            "bg-white shadow-xl ring-1 ring-black/5 transition-all duration-300 origin-top overflow-hidden min-h-[800px]",
                            viewport === 'desktop' ? "w-full max-w-5xl rounded-lg" : "w-[390px] rounded-[2.5rem] border-[8px] border-slate-800"
                        )}
                    >
                        {/* Canvas Content Rendering (Placeholder logic for Phase 1) */}
                        <div className="divide-y divide-slate-100">
                            {version.structureJson.sections?.length > 0 ? (
                                version.structureJson.sections.map((section, idx) => (
                                    <div key={section.id || idx} className="group relative p-12 hover:bg-primary/5 transition-colors border-2 border-transparent hover:border-primary/40 border-dashed">
                                        <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity bg-primary text-white text-[10px] font-bold px-2 py-1 rounded">
                                            Section {idx + 1}
                                        </div>
                                        
                                        <div className="max-w-4xl mx-auto space-y-6">
                                            {section.blocks?.map((block, bIdx) => (
                                                <div key={block.id || bIdx} className="p-4 bg-white ring-1 ring-slate-200 rounded-xl relative hover:ring-2 hover:ring-primary shadow-sm transition-all cursor-pointer">
                                                    {block.type === 'hero' && (
                                                        <div className="text-center space-y-4 py-8">
                                                            <h2 className="text-4xl font-bold tracking-tight text-slate-900">{block.props.title || 'Hero Title'}</h2>
                                                            <p className="text-lg text-slate-500">{block.props.subtitle || 'Hero Subtitle text goes here.'}</p>
                                                        </div>
                                                    )}
                                                    {block.type === 'form' && (
                                                        <div className="max-w-md mx-auto space-y-4 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                                                            <div className="space-y-4">
                                                                {block.props.fields?.map((f: any, fIdx: number) => (
                                                                    <div key={fIdx} className="space-y-1.5 text-left">
                                                                        <Label className="text-xs font-semibold">{f.label}</Label>
                                                                        <Input placeholder={`Enter ${f.label.toLowerCase()}`} className="bg-white border-slate-200" />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <Button className="w-full font-bold">{block.props.buttonText || 'Submit'}</Button>
                                                        </div>
                                                    )}
                                                    {block.type !== 'hero' && block.type !== 'form' && (
                                                        <div className="text-center p-4">
                                                            <Badge variant="outline">{block.type} block placeholder</Badge>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-24 text-center space-y-4">
                                    <div className="w-16 h-16 bg-slate-50 rounded-2xl mx-auto flex items-center justify-center border border-slate-200 border-dashed">
                                        <PlusSquare className="w-6 h-6 text-slate-300" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold">Drag blocks here</h3>
                                        <p className="text-xs text-slate-500 mt-1">Start building your page layout</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
