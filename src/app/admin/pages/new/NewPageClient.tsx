'use client';

import * as React from 'react';
import { useState } from 'react';
import { collection, query, getDocs, doc, setDoc } from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/context/TenantContext';
import { Layout, ArrowLeft, Loader2, Sparkles, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PageTemplate, CampaignPage, CampaignPageVersion } from '@/lib/types';
import Link from 'next/link';

export default function NewPageClient() {
    const firestore = useFirestore();
    const { user } = useUser();
    const router = useRouter();
    const { toast } = useToast();
    const { activeWorkspaceId, activeOrganizationId: organizationId } = useTenant();

    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    // Fetch templates
    const templatesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'page_templates')) : null, [firestore]);
    const { data: templates, isLoading: templatesLoading } = useCollection<PageTemplate>(templatesQuery);

    React.useEffect(() => {
        if (name) {
            setSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''));
        }
    }, [name]);

    const handleCreate = async () => {
        if (!name || !slug || !selectedTemplateId) {
            toast({ variant: 'destructive', title: 'Missing explicit fields', description: 'Please provide a name and select a template.' });
            return;
        }

        if (!firestore || !user || !organizationId || !activeWorkspaceId) {
            toast({ variant: 'destructive', title: 'System Error', description: 'Missing context properties (Auth or Tenant).' });
            return;
        }

        setIsCreating(true);

        try {
            const template = templates?.find(t => t.id === selectedTemplateId);
            if (!template) throw new Error('Template not found');

            const newPageId = doc(collection(firestore, 'campaign_pages')).id;
            const newVersionId = doc(collection(firestore, 'campaign_page_versions')).id;
            
            const timestamp = new Date().toISOString();

            // Create initial version
            const version: CampaignPageVersion = {
                id: newVersionId,
                pageId: newPageId,
                organizationId,
                versionNumber: 1,
                structureJson: template.structureJson,
                createdBy: user.uid,
                createdAt: timestamp,
                isPublishedVersion: false
            };
            
            await setDoc(doc(firestore, 'campaign_page_versions', newVersionId), version);

            // Create page document
            const page: CampaignPage = {
                id: newPageId,
                organizationId,
                workspaceIds: [activeWorkspaceId],
                name,
                slug,
                status: 'draft',
                pageGoal: template.goal || 'information',
                themeId: null,
                seo: {
                    title: name,
                    description: '',
                    noIndex: false
                },
                settings: {
                    customScriptsAllowed: false,
                    showHeader: true,
                    showFooter: true
                },
                createdBy: user.uid,
                createdAt: timestamp,
                updatedAt: timestamp
            };
            
            await setDoc(doc(firestore, 'campaign_pages', newPageId), page);

            toast({ title: 'Page Created', description: 'Redirecting to builder...' });
            router.push(`/admin/pages/${newPageId}/builder`);

        } catch (error: any) {
            setIsCreating(false);
            toast({ variant: 'destructive', title: 'Creation failed', description: error.message });
        }
    };

    return (
        <div className="h-full overflow-y-auto bg-background p-6 lg:p-12 relative">
            <div className="max-w-5xl mx-auto space-y-12 pb-32">
                <div className="flex items-center gap-4">
                    <Button asChild variant="ghost" className="rounded-xl h-10 w-10 p-0 hover:bg-muted">
                        <Link href="/admin/pages"><ArrowLeft className="h-5 w-5" /></Link>
                    </Button>
                    <div>
                        <h1 className="text-3xl font-semibold tracking-tighter flex items-center gap-3">
                            Let's build a page
                        </h1>
                        <p className="text-muted-foreground font-medium mt-1">
                            Set up the foundation for your new public campaign page.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-12">
                    <div className="space-y-8">
                        <div>
                            <Label className="text-sm font-semibold mb-3 block">Choose a template</Label>
                            {templatesLoading ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="h-40 rounded-2xl bg-muted animate-pulse" />
                                    <div className="h-40 rounded-2xl bg-muted animate-pulse" />
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {templates?.map(t => (
                                        <Card 
                                            key={t.id} 
                                            className={cn(
                                                "cursor-pointer group hover:border-primary transition-all rounded-3xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 duration-300",
                                                selectedTemplateId === t.id ? "ring-2 ring-primary border-primary bg-primary/5" : "border-border/50 bg-card"
                                            )}
                                            onClick={() => setSelectedTemplateId(t.id)}
                                        >
                                            <div className="h-32 bg-muted/20 flex items-center justify-center border-b border-border/50 group-hover:bg-primary/5 transition-colors">
                                                {t.id === 'blank-page' ? (
                                                    <PlusCircle className="text-muted-foreground w-10 h-10 opacity-30 group-hover:opacity-100 transition-opacity" />
                                                ) : (
                                                    <Layout className="text-primary/30 w-10 h-10 group-hover:scale-110 transition-transform duration-500" />
                                                )}
                                            </div>
                                            <CardHeader className="p-5">
                                                <div className="flex items-center justify-between mb-1">
                                                    <CardTitle className="text-sm font-bold">{t.name}</CardTitle>
                                                    {t.goal === 'lead_capture' && <Badge className="text-[8px] h-4 bg-emerald-500 hover:bg-emerald-500">ROI+</Badge>}
                                                </div>
                                                <CardDescription className="text-[10px] font-medium leading-relaxed">{t.description}</CardDescription>
                                            </CardHeader>
                                        </Card>

                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <Card className="rounded-3xl border-border/50 shadow-xl bg-card overflow-hidden">
                            <CardHeader className="p-6 bg-muted/10 border-b border-border/50 text-left">
                                <CardTitle className="text-base font-semibold flex items-center gap-2">
                                    <Sparkles className="h-4 w-4 text-primary" /> Page Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-5">
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold text-muted-foreground">Internal Name</Label>
                                    <Input 
                                        value={name} 
                                        onChange={e => setName(e.target.value)} 
                                        placeholder="e.g. Q1 Admissions Drive" 
                                        className="h-12 rounded-xl transition-all font-semibold"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold text-muted-foreground">URL Path</Label>
                                    <div className="flex rounded-xl overflow-hidden ring-1 ring-border shadow-inner">
                                        <div className="bg-muted px-4 flex items-center text-xs text-muted-foreground border-r font-medium">
                                            /p/
                                        </div>
                                        <Input 
                                            value={slug} 
                                            onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} 
                                            className="h-11 rounded-none border-none shadow-none font-semibold focus-visible:ring-0 px-3"
                                        />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground ml-1">Must be unique per organization track.</p>
                                </div>
                            </CardContent>
                            <CardFooter className="p-6 pt-0">
                                <Button 
                                    onClick={handleCreate} 
                                    disabled={!name || !slug || !selectedTemplateId || isCreating} 
                                    className="w-full h-12 rounded-xl font-bold bg-primary hover:bg-primary/90 shadow-lg text-[11px] gap-2"
                                >
                                    {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
                                    Create and Edit Page
                                </Button>
                            </CardFooter>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
