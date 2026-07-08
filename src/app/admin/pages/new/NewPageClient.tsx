'use client';

import * as React from 'react';
import { useState, useMemo } from 'react';
import { collection, doc, setDoc } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { getPublishedTemplatesAction } from '@/lib/backoffice/backoffice-template-actions';
import type { PlatformTemplate } from '@/lib/backoffice/backoffice-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/context/TenantContext';
import { INDUSTRY_LABELS, getEnabledIndustries } from '@/lib/industry-config';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
const LOCAL_INDUSTRY_LABELS: Record<string, string> = {
  SaaS: 'SaaS Product',
  SchoolEnrollment: 'School Admissions',
  Marketing: 'Marketing Agency',
  Law: 'Law Practice',
  RealEstate: 'Real Estate',
  Consultancy: 'Consultancy',
};

import {
    ArrowLeft,
    Loader2,
    Sparkles,
    PlusCircle,
    CheckCircle2,
    Layout,
    Target,
    UserPlus,
    Info,
    CreditCard,
    Heart,
    Search,
    ArrowRight,
    Eye,
    Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PageTemplate, CampaignPage, CampaignPageVersion } from '@/lib/types';
import Link from 'next/link';

const GOAL_ICONS: Record<string, any> = {
    lead_capture: Target,
    registration: UserPlus,
    information: Info,
    payment: CreditCard,
    thank_you: Heart,
};

const GOAL_COLORS: Record<string, string> = {
    lead_capture: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    registration: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    information: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
    payment: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    thank_you: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20',
};

function TemplateThumbnail({ template, isBlank }: { template: PageTemplate; isBlank: boolean }) {
    if (isBlank) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="p-4 rounded-xl border-2 border-dashed border-border/80 group-hover:border-secondary/50 transition-colors">
                    <PlusCircle className="w-8 h-8 text-muted-foreground group-hover:text-secondary transition-colors" />
                </div>
            </div>
        );
    }

    // Auto-generated mini-preview showing section/block structure
    const sections = template.structureJson?.sections || [];
    return (
        <div className="h-full flex flex-col p-3 gap-1.5 overflow-hidden">
            {sections.slice(0, 3).map((sec, si) => (
                <div key={si} className="flex flex-col gap-1">
                    {sec.blocks.slice(0, 2).map((block, bi) => (
                        <div key={bi} className={cn(
                            "rounded transition-colors",
                            block.type === 'hero' && "h-6 bg-muted/60 group-hover:bg-secondary/20",
                            block.type === 'text' && "h-3 bg-muted/40 w-3/4 group-hover:bg-secondary/10",
                            block.type === 'cta' && "h-4 w-16 bg-secondary/30 rounded-full mx-auto group-hover:bg-secondary/40",
                            block.type === 'form' && "h-8 bg-blue-500/10 border border-blue-500/20 group-hover:bg-blue-500/15",
                            block.type === 'image' && "h-5 bg-muted/50 group-hover:bg-secondary/15",
                            !['hero', 'text', 'cta', 'form', 'image'].includes(block.type) && "h-3 bg-muted/30 group-hover:bg-secondary/10"
                        )} />
                    ))}
                </div>
            ))}
            {sections.length === 0 && (
                <div className="flex-1 flex items-center justify-center">
                    <Layout className="w-6 h-6 text-muted-foreground/50" />
                </div>
            )}
        </div>
    );
}

export default function NewPageClient() {
    const firestore = useFirestore();
    const { user } = useUser();
    const router = useRouter();
    const { toast } = useToast();
    const { activeWorkspaceId, activeWorkspace, activeOrganizationId: organizationId } = useTenant();

    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [searchFilter, setSearchFilter] = useState('');
    const [goalFilter, setGoalFilter] = useState<string | null>(null);
    const [industryFilter, setIndustryFilter] = useState<string | null>(null);
    const [previewTemplate, setPreviewTemplate] = useState<PageTemplate | null>(null);

    // Fetch templates
    const [platformTemplates, setPlatformTemplates] = useState<PlatformTemplate[]>([]);
    const [templatesLoading, setTemplatesLoading] = useState(true);

    React.useEffect(() => {
        let active = true;
        async function fetchPlatformTemplates() {
            setTemplatesLoading(true);
            try {
                const res = await getPublishedTemplatesAction('page');
                if (res.success && res.data && active) {
                    setPlatformTemplates(res.data);
                }
            } catch (err) {
                console.error('Failed to load platform page templates:', err);
            } finally {
                if (active) setTemplatesLoading(false);
            }
        }
        fetchPlatformTemplates();
        return () => {
            active = false;
        };
    }, []);

    const templates = useMemo(() => {
        return platformTemplates.map(pt => {
            const rawContent = pt.content as Record<string, unknown> | null;
            const goalValue = (rawContent?.goal as string) || pt.category || 'information';
            const structureValue = (rawContent?.structureJson as import('@/lib/types').CampaignPageStructure) || { sections: [] };
            const industryValue = (rawContent?.industry as string) || 
              (typeof pt === 'object' && pt !== null && 'industry' in pt && typeof (pt as Record<string, unknown>).industry === 'string'
                ? (pt as Record<string, unknown>).industry as string
                : 'all');

            return {
                id: pt.id,
                name: pt.name,
                description: pt.description,
                goal: goalValue,
                isGlobal: pt.scope === 'system',
                structureJson: structureValue,
                industry: industryValue,
                createdAt: pt.createdAt,
                updatedAt: pt.updatedAt
            } as PageTemplate;
        });
    }, [platformTemplates]);

    // Initialize industryFilter once activeWorkspace resolves
    React.useEffect(() => {
        if (activeWorkspace?.industry) {
            setIndustryFilter(activeWorkspace.industry);
        }
    }, [activeWorkspace?.industry]);

    React.useEffect(() => {
        if (name) {
            setSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''));
        }
    }, [name]);

    const filteredTemplates = useMemo(() => {
        if (!templates) return [];
        return templates.filter(t => {
            if (searchFilter && !t.name.toLowerCase().includes(searchFilter.toLowerCase()) && !t.description.toLowerCase().includes(searchFilter.toLowerCase())) return false;
            if (goalFilter && t.goal !== goalFilter) return false;
            
            // If an industry filter is active, filter strictly. Otherwise, show everything.
            if (industryFilter && industryFilter !== 'all') {
                if (t.industry && t.industry !== industryFilter) return false;
            }
            return true;
        });
    }, [templates, searchFilter, goalFilter, industryFilter]);

    const goalCounts = useMemo(() => {
        if (!templates) return {};
        const counts: Record<string, number> = {};
        templates.forEach(t => { counts[t.goal] = (counts[t.goal] || 0) + 1; });
        return counts;
    }, [templates]);

    const selectedTemplate = templates?.find(t => t.id === selectedTemplateId);

    const handleCreate = async () => {
        if (!name || !slug || !selectedTemplateId) {
            toast({ variant: 'destructive', title: 'Missing fields', description: 'Please provide a name and select a template.' });
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

            const page: CampaignPage = {
                id: newPageId,
                organizationId,
                workspaceIds: [activeWorkspaceId],
                name,
                slug,
                status: 'draft',
                pageGoal: template.goal || 'information',
                themeId: null,
                seo: { title: name, description: '', noIndex: false },
                settings: { customScriptsAllowed: false, showHeader: true, showFooter: true },
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
        <div className="h-full overflow-y-auto bg-background text-foreground transition-colors duration-200">
            {/* Grid Pattern */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.02] dark:opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

            <div className="max-w-7xl mx-auto space-y-10 pb-32 px-6 pt-8 relative">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button asChild variant="ghost" className="h-9 w-9 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent hover:border-border">
                            <Link href="/admin/pages"><ArrowLeft className="h-4 w-4" /></Link>
                        </Button>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-3">
                                <div className="p-2 bg-secondary/10 rounded-xl border border-secondary/25">
                                    <Sparkles className="h-5 w-5 text-secondary" />
                                </div>
                                Create a New Page
                            </h1>
                            <p className="text-sm text-muted-foreground font-medium mt-1 ml-14">
                                Choose a template and customize your campaign page.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-10">
                    {/* ─── Template Gallery ─── */}
                    <div className="space-y-6">
                        {/* Filter Bar */}
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="relative flex-1 min-w-[200px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <Input
                                    value={searchFilter}
                                    onChange={(e) => setSearchFilter(e.target.value)}
                                    placeholder="Search templates..."
                                    className="h-9 pl-10 rounded-lg bg-card border border-border text-xs font-semibold text-foreground focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground focus:border-border"
                                />
                            </div>
                            <div className="w-[180px]">
                                <Select
                                    value={industryFilter || 'all'}
                                    onValueChange={(val) => setIndustryFilter(val === 'all' ? null : val)}
                                >
                                    <SelectTrigger className="bg-card border border-border focus:ring-ring text-foreground rounded-lg h-9 text-xs font-semibold">
                                        <SelectValue placeholder="All Verticals" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-popover border border-border text-popover-foreground">
                                        <SelectItem value="all">All Verticals</SelectItem>
                                        {getEnabledIndustries().map((ind) => (
                                            <SelectItem key={ind} value={ind}>
                                                {(INDUSTRY_LABELS && INDUSTRY_LABELS[ind as keyof typeof INDUSTRY_LABELS]) || LOCAL_INDUSTRY_LABELS[ind] || ind}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <button
                                onClick={() => setGoalFilter(null)}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border",
                                    !goalFilter
                                        ? "bg-primary text-primary-foreground border-transparent shadow-sm"
                                        : "bg-card text-muted-foreground hover:text-foreground border-border hover:bg-muted/50"
                                )}
                            >
                                All ({templates?.length || 0})
                            </button>
                            {Object.entries(goalCounts).map(([goal, count]) => {
                                const GoalIcon = GOAL_ICONS[goal] || Info;
                                return (
                                    <button
                                        key={goal}
                                        onClick={() => setGoalFilter(goal === goalFilter ? null : goal)}
                                        className={cn(
                                            "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 border",
                                            goal === goalFilter
                                                ? "bg-secondary text-secondary-foreground border-transparent shadow-sm"
                                                : "bg-card text-muted-foreground hover:text-foreground border-border hover:bg-muted/50"
                                        )}
                                    >
                                        <GoalIcon className="w-3 h-3" />
                                        {goal.replace('_', ' ')} ({count})
                                    </button>
                                );
                            })}
                        </div>

                        {/* Template Grid */}
                        {templatesLoading ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} className="h-56 rounded-xl bg-muted/40 animate-pulse border border-border" />
                                ))}
                            </div>
                        ) : filteredTemplates.length === 0 ? (
                            <div className="text-center py-20 border-2 border-dashed border-border rounded-xl">
                                <Layout className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                                <p className="text-sm font-semibold text-foreground">No templates found</p>
                                <p className="text-xs text-muted-foreground mt-1">Try adjusting your filter or search.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {filteredTemplates.map(t => {
                                    const isBlank = t.id === 'blank-page';
                                    const isSelected = selectedTemplateId === t.id;
                                    const GoalIcon = GOAL_ICONS[t.goal] || Info;

                                    return (
                                        <div
                                            key={t.id}
                                            onClick={() => setSelectedTemplateId(t.id)}
                                            className={cn(
                                                "group cursor-pointer rounded-xl border overflow-hidden transition-all duration-300 hover:-translate-y-1 shadow-sm",
                                                isSelected
                                                    ? "border-secondary/50 ring-2 ring-secondary/15 bg-card/90"
                                                    : "border-border bg-card hover:border-muted-foreground/30 hover:shadow-md"
                                            )}
                                        >
                                            {/* Thumbnail */}
                                            <div className="h-32 bg-muted/40 border-b border-border/50 relative">
                                                <TemplateThumbnail template={t} isBlank={isBlank} />
                                                {isSelected && (
                                                    <div className="absolute top-2 right-2 p-0.5 bg-secondary rounded-full shadow-md text-secondary-foreground animate-in zoom-in duration-200">
                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                    </div>
                                                )}
                                                {/* Preview hover button */}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setPreviewTemplate(t); }}
                                                    className="absolute bottom-2 right-2 h-6 px-2 rounded-lg bg-card/90 backdrop-blur-sm border border-border text-[9px] font-bold text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1"
                                                >
                                                    <Eye className="w-3 h-3" /> Preview
                                                </button>
                                            </div>

                                            {/* Meta */}
                                            <div className="p-4 space-y-2">
                                                <div className="flex items-between justify-between w-full">
                                                    <h3 className="text-xs font-bold text-foreground group-hover:text-foreground transition-colors truncate max-w-[120px]">{t.name}</h3>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        {t.industry && t.industry === (activeWorkspace?.industry || 'SaaS') && (
                                                            <Badge className="text-[7px] h-4 bg-secondary/10 text-secondary border-secondary/20 font-bold tracking-wider">
                                                                REC
                                                            </Badge>
                                                        )}
                                                        <Badge className={cn("text-[7px] h-4 border font-bold", GOAL_COLORS[t.goal] || 'bg-muted text-muted-foreground border-border')}>
                                                            {t.goal.replace('_', ' ')}
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">{t.description}</p>
                                                <div className="flex items-center gap-2 pt-1">
                                                    <span className="text-[9px] text-muted-foreground/80 font-medium">
                                                        {t.structureJson?.sections?.length || 0} section{(t.structureJson?.sections?.length || 0) !== 1 ? 's' : ''}
                                                    </span>
                                                    <span className="text-muted-foreground/50">·</span>
                                                    <span className="text-[9px] text-muted-foreground/80 font-medium">
                                                        {t.structureJson?.sections?.reduce((acc: number, s: any) => acc + (s.blocks?.length || 0), 0) || 0} blocks
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* ─── Right Panel: Page Details ─── */}
                    <div className="space-y-6">
                        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                            <div className="p-5 border-b border-border flex items-center gap-3">
                                <div className="p-2 bg-secondary/10 rounded-lg border border-secondary/20">
                                    <Zap className="h-4 w-4 text-secondary" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-foreground">Page Details</h3>
                                    <p className="text-[10px] text-muted-foreground font-medium">Configure your new page.</p>
                                </div>
                            </div>

                            <div className="p-5 space-y-5">
                                {/* Selected Template */}
                                {selectedTemplate && (
                                    <div className="p-3 rounded-lg bg-secondary/5 border border-secondary/20 flex items-center gap-3">
                                        <CheckCircle2 className="w-4 h-4 text-secondary shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-[11px] font-bold text-secondary truncate">{selectedTemplate.name}</p>
                                            <p className="text-[9px] text-muted-foreground font-medium">{selectedTemplate.goal.replace('_', ' ')} template</p>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Page Name</Label>
                                    <Input
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        placeholder="e.g. Q1 Admissions Drive"
                                        className="h-10 rounded-lg bg-card border border-border text-xs font-semibold text-foreground focus-visible:ring-1 focus-visible:ring-ring focus:border-border"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">URL Path</Label>
                                    <div className="flex rounded-lg overflow-hidden border border-border bg-card focus-within:ring-1 focus-within:ring-ring">
                                        <div className="bg-muted px-3 flex items-center text-[10px] text-muted-foreground border-r border-border font-bold shrink-0">
                                            /p/
                                        </div>
                                        <Input
                                            value={slug}
                                            onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                            className="h-10 rounded-none border-none bg-card text-xs font-semibold text-foreground focus-visible:ring-0 px-3"
                                        />
                                    </div>
                                    <p className="text-[9px] text-muted-foreground/80 ml-1">Must be unique per organization.</p>
                                </div>
                            </div>

                            <div className="p-5 pt-0">
                                <Button
                                    onClick={handleCreate}
                                    disabled={!name || !slug || !selectedTemplateId || isCreating}
                                    className="w-full h-11 rounded-lg font-bold text-xs bg-primary hover:opacity-90 text-primary-foreground shadow-sm gap-2 disabled:opacity-30 transition-all active:scale-[0.98]"
                                >
                                    {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                                    Create & Open Builder
                                </Button>
                            </div>
                        </div>

                        {/* Quick Tips */}
                        <div className="p-4 rounded-xl border border-border bg-card/50 space-y-3 shadow-sm">
                            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Quick Tips</h4>
                            <div className="space-y-2">
                                {[
                                    'Use the builder to drag, drop, and customize blocks.',
                                    'Embed forms and surveys to capture leads.',
                                    'Add triggers for automations and popups.',
                                    'Publish when ready — preview anytime.',
                                ].map((tip, i) => (
                                    <div key={i} className="flex items-start gap-2">
                                        <div className="h-4 w-4 rounded-full bg-secondary/10 flex items-center justify-center shrink-0 mt-0.5">
                                            <CheckCircle2 className="h-2.5 w-2.5 text-secondary" />
                                        </div>
                                        <p className="text-[10px] text-muted-foreground leading-relaxed">{tip}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Preview Modal */}
            {previewTemplate && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-8" onClick={() => setPreviewTemplate(null)}>
                    <div className="bg-card border border-border rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-foreground">{previewTemplate.name}</h3>
                                <p className="text-xs text-muted-foreground mt-1">{previewTemplate.description}</p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setPreviewTemplate(null)} className="text-muted-foreground hover:text-foreground">
                                Close
                            </Button>
                        </div>

                        <div className="space-y-4">
                            {previewTemplate.structureJson?.sections?.map((sec, si) => (
                                <div key={si} className="p-4 rounded-lg bg-muted/20 border border-border space-y-2">
                                    <p className="text-[9px] font-bold text-secondary uppercase">Section {si + 1}</p>
                                    <div className="space-y-1.5">
                                        {sec.blocks.map((block, bi) => {
                                            const props = (block.props || {}) as Record<string, unknown>;
                                            const titleVal = typeof props.title === 'string' ? props.title : '';
                                            const labelVal = typeof props.label === 'string' ? props.label : '';
                                            const contentVal = typeof props.content === 'string' ? props.content : '';
                                            return (
                                                <div key={bi} className="flex items-center gap-2 p-2 bg-card/65 border border-border/40 rounded-lg">
                                                    <Badge className="text-[8px] h-4 bg-muted text-muted-foreground border-border">{block.type}</Badge>
                                                    <span className="text-[10px] text-muted-foreground truncate">
                                                        {titleVal || labelVal || contentVal.substring(0, 50) || '—'}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                            {(!previewTemplate.structureJson?.sections || previewTemplate.structureJson.sections.length === 0) && (
                                <p className="text-center text-sm text-muted-foreground py-8">Blank template — start from scratch.</p>
                            )}
                        </div>

                        <div className="mt-6 flex justify-end">
                            <Button
                                onClick={() => { setSelectedTemplateId(previewTemplate.id); setPreviewTemplate(null); }}
                                className="h-9 px-6 rounded-lg font-bold text-xs bg-primary text-primary-foreground hover:opacity-90 shadow-sm"
                            >
                                Use This Template
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
