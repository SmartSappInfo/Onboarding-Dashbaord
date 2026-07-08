'use client';

import * as React from 'react';
import { useState, useMemo } from 'react';
import { collection, query, doc, setDoc } from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/context/TenantContext';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
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
    lead_capture: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    registration: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    information: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    payment: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    thank_you: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
};

function TemplateThumbnail({ template, isBlank }: { template: PageTemplate; isBlank: boolean }) {
    if (isBlank) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="p-4 rounded-2xl border-2 border-dashed border-slate-600 group-hover:border-emerald-500/50 transition-colors">
                    <PlusCircle className="w-8 h-8 text-slate-600 group-hover:text-emerald-400 transition-colors" />
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
                            block.type === 'hero' && "h-6 bg-slate-600/40 group-hover:bg-emerald-500/20",
                            block.type === 'text' && "h-3 bg-slate-700/30 w-3/4 group-hover:bg-emerald-500/10",
                            block.type === 'cta' && "h-4 w-16 bg-emerald-600/30 rounded-full mx-auto group-hover:bg-emerald-500/40",
                            block.type === 'form' && "h-8 bg-blue-500/10 border border-blue-500/20 group-hover:bg-blue-500/15",
                            block.type === 'image' && "h-5 bg-slate-600/30 group-hover:bg-emerald-500/15",
                            !['hero', 'text', 'cta', 'form', 'image'].includes(block.type) && "h-3 bg-slate-700/20 group-hover:bg-emerald-500/10"
                        )} />
                    ))}
                </div>
            ))}
            {sections.length === 0 && (
                <div className="flex-1 flex items-center justify-center">
                    <Layout className="w-6 h-6 text-slate-600/50" />
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
    const templatesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'page_templates')) : null, [firestore]);
    const { data: templates, isLoading: templatesLoading } = useCollection<PageTemplate>(templatesQuery);

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
        <div className="h-full overflow-y-auto" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)' }}>
            {/* Grid Pattern */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, #94a3b8 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

            <div className="max-w-7xl mx-auto space-y-10 pb-32 px-6 pt-8 relative">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button asChild variant="ghost" className="h-9 w-9 p-0 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800">
                            <Link href="/admin/pages"><ArrowLeft className="h-4 w-4" /></Link>
                        </Button>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-slate-100 flex items-center gap-3">
                                <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                                    <Sparkles className="h-5 w-5 text-emerald-400" />
                                </div>
                                Create a New Page
                            </h1>
                            <p className="text-sm text-slate-500 font-medium mt-1 ml-14">
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
                                    className="h-9 pl-10 rounded-xl bg-slate-800/50 border-slate-700 text-xs font-semibold text-slate-200 focus:border-emerald-500/50 placeholder:text-slate-600"
                                />
                            </div>
                            <div className="w-[180px]">
                                <Select
                                    value={industryFilter || 'all'}
                                    onValueChange={(val) => setIndustryFilter(val === 'all' ? null : val)}
                                >
                                    <SelectTrigger className="bg-slate-800/50 border-slate-700 focus:ring-emerald-500/50 text-slate-300 rounded-xl h-9 text-xs font-semibold">
                                        <SelectValue placeholder="All Verticals" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-300">
                                        <SelectItem value="all">All Verticals</SelectItem>
                                        <SelectItem value="SaaS">SaaS Product</SelectItem>
                                        <SelectItem value="SchoolEnrollment">School Admissions</SelectItem>
                                        <SelectItem value="Marketing">Marketing Agency</SelectItem>
                                        <SelectItem value="Law">Law Practice</SelectItem>
                                        <SelectItem value="RealEstate">Real Estate</SelectItem>
                                        <SelectItem value="Consultancy">Consultancy</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <button
                                onClick={() => setGoalFilter(null)}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                                    !goalFilter ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "text-slate-500 hover:text-slate-350 border border-slate-700/50 hover:border-slate-600"
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
                                            "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5",
                                            goal === goalFilter ? GOAL_COLORS[goal] + ' border' : "text-slate-500 hover:text-slate-300 border border-slate-700/50 hover:border-slate-600"
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
                                    <div key={i} className="h-56 rounded-2xl bg-slate-800/50 animate-pulse border border-slate-700/30" />
                                ))}
                            </div>
                        ) : filteredTemplates.length === 0 ? (
                            <div className="text-center py-20 border-2 border-dashed border-slate-700 rounded-2xl">
                                <Layout className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                                <p className="text-sm font-semibold text-slate-400">No templates found</p>
                                <p className="text-xs text-slate-600 mt-1">Try adjusting your filter or search.</p>
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
                                                "group cursor-pointer rounded-2xl border overflow-hidden transition-all duration-300 hover:-translate-y-1",
                                                isSelected
                                                    ? "border-emerald-500/50 ring-2 ring-emerald-500/20 bg-slate-800/80 shadow-xl shadow-emerald-500/5"
                                                    : "border-slate-700/50 bg-slate-800/40 hover:border-slate-600 hover:shadow-lg"
                                            )}
                                        >
                                            {/* Thumbnail */}
                                            <div className="h-32 bg-slate-900/50 border-b border-slate-700/30 relative">
                                                <TemplateThumbnail template={t} isBlank={isBlank} />
                                                {isSelected && (
                                                    <div className="absolute top-2 right-2 p-1 bg-emerald-500 rounded-full shadow-lg shadow-emerald-500/30 animate-in zoom-in duration-200">
                                                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                                                    </div>
                                                )}
                                                {/* Preview hover button */}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setPreviewTemplate(t); }}
                                                    className="absolute bottom-2 right-2 h-6 px-2 rounded-lg bg-slate-800/80 backdrop-blur-sm border border-slate-700 text-[9px] font-bold text-slate-400 hover:text-slate-200 opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1"
                                                >
                                                    <Eye className="w-3 h-3" /> Preview
                                                </button>
                                            </div>

                                            {/* Meta */}
                                            <div className="p-4 space-y-2">
                                                <div className="flex items-between justify-between w-full">
                                                    <h3 className="text-xs font-bold text-slate-200 group-hover:text-slate-100 transition-colors truncate max-w-[120px]">{t.name}</h3>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        {t.industry && t.industry === (activeWorkspace?.industry || 'SaaS') && (
                                                            <Badge className="text-[7px] h-4 bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-bold tracking-wider">
                                                                REC
                                                            </Badge>
                                                        )}
                                                        <Badge className={cn("text-[7px] h-4 border font-bold", GOAL_COLORS[t.goal] || 'bg-slate-700 text-slate-400 border-slate-600')}>
                                                            {t.goal.replace('_', ' ')}
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <p className="text-[10px] text-slate-500 leading-relaxed line-clamp-2">{t.description}</p>
                                                <div className="flex items-center gap-2 pt-1">
                                                    <span className="text-[9px] text-slate-600 font-medium">
                                                        {t.structureJson?.sections?.length || 0} section{(t.structureJson?.sections?.length || 0) !== 1 ? 's' : ''}
                                                    </span>
                                                    <span className="text-slate-700">·</span>
                                                    <span className="text-[9px] text-slate-600 font-medium">
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
                        <div className="rounded-2xl border border-slate-700/50 overflow-hidden" style={{ background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(12px)' }}>
                            <div className="p-5 border-b border-slate-700/50 flex items-center gap-3">
                                <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                                    <Zap className="h-4 w-4 text-emerald-400" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-200">Page Details</h3>
                                    <p className="text-[10px] text-slate-500">Configure your new page.</p>
                                </div>
                            </div>

                            <div className="p-5 space-y-5">
                                {/* Selected Template */}
                                {selectedTemplate && (
                                    <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center gap-3">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-[11px] font-bold text-emerald-400 truncate">{selectedTemplate.name}</p>
                                            <p className="text-[9px] text-slate-500">{selectedTemplate.goal.replace('_', ' ')} template</p>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-slate-500 uppercase">Page Name</Label>
                                    <Input
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        placeholder="e.g. Q1 Admissions Drive"
                                        className="h-10 rounded-xl bg-slate-800 border-slate-700 text-xs font-semibold text-slate-200 focus:border-emerald-500/50"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-slate-500 uppercase">URL Path</Label>
                                    <div className="flex rounded-xl overflow-hidden ring-1 ring-slate-700">
                                        <div className="bg-slate-800 px-3 flex items-center text-[10px] text-slate-500 border-r border-slate-700 font-bold shrink-0">
                                            /p/
                                        </div>
                                        <Input
                                            value={slug}
                                            onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                            className="h-10 rounded-none border-none bg-slate-800 text-xs font-semibold text-slate-200 focus-visible:ring-0 px-3"
                                        />
                                    </div>
                                    <p className="text-[9px] text-slate-600 ml-1">Must be unique per organization.</p>
                                </div>
                            </div>

                            <div className="p-5 pt-0">
                                <Button
                                    onClick={handleCreate}
                                    disabled={!name || !slug || !selectedTemplateId || isCreating}
                                    className="w-full h-11 rounded-xl font-bold text-xs bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 gap-2 disabled:opacity-30 transition-all"
                                >
                                    {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                                    Create & Open Builder
                                </Button>
                            </div>
                        </div>

                        {/* Quick Tips */}
                        <div className="p-4 rounded-2xl border border-slate-700/30 bg-slate-800/20 space-y-3">
                            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Quick Tips</h4>
                            <div className="space-y-2">
                                {[
                                    'Use the builder to drag, drop, and customize blocks.',
                                    'Embed forms and surveys to capture leads.',
                                    'Add triggers for automations and popups.',
                                    'Publish when ready — preview anytime.',
                                ].map((tip, i) => (
                                    <div key={i} className="flex items-start gap-2">
                                        <div className="h-4 w-4 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                                            <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />
                                        </div>
                                        <p className="text-[10px] text-slate-500 leading-relaxed">{tip}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Preview Modal */}
            {previewTemplate && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-8" onClick={() => setPreviewTemplate(null)}>
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-slate-100">{previewTemplate.name}</h3>
                                <p className="text-xs text-slate-500 mt-1">{previewTemplate.description}</p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setPreviewTemplate(null)} className="text-slate-400 hover:text-slate-200">
                                Close
                            </Button>
                        </div>

                        <div className="space-y-4">
                            {previewTemplate.structureJson?.sections?.map((sec, si) => (
                                <div key={si} className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-2">
                                    <p className="text-[9px] font-bold text-emerald-400 uppercase">Section {si + 1}</p>
                                    <div className="space-y-1.5">
                                        {sec.blocks.map((block, bi) => {
                                            const props = (block.props || {}) as Record<string, unknown>;
                                            const titleVal = typeof props.title === 'string' ? props.title : '';
                                            const labelVal = typeof props.label === 'string' ? props.label : '';
                                            const contentVal = typeof props.content === 'string' ? props.content : '';
                                            return (
                                                <div key={bi} className="flex items-center gap-2 p-2 bg-slate-900/50 rounded-lg">
                                                    <Badge className="text-[8px] h-4 bg-slate-700 text-slate-300 border-slate-600">{block.type}</Badge>
                                                    <span className="text-[10px] text-slate-400 truncate">
                                                        {titleVal || labelVal || contentVal.substring(0, 50) || '—'}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                            {(!previewTemplate.structureJson?.sections || previewTemplate.structureJson.sections.length === 0) && (
                                <p className="text-center text-sm text-slate-500 py-8">Blank template — start from scratch.</p>
                            )}
                        </div>

                        <div className="mt-6 flex justify-end">
                            <Button
                                onClick={() => { setSelectedTemplateId(previewTemplate.id); setPreviewTemplate(null); }}
                                className="h-9 px-6 rounded-xl font-bold text-xs bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
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
