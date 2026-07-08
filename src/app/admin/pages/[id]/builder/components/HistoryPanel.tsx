'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { History, FolderHeart, Loader2, Sparkles, Quote, HelpCircle, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CampaignPageVersion, PageSectionTemplate } from '@/lib/types';
import { useTenant } from '@/context/TenantContext';
import { STATIC_SECTION_TEMPLATES } from '@/lib/page-builder/templates/sections';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface HistoryPanelProps {
    readonly versions: CampaignPageVersion[];
    readonly currentVersionId: string | null;
    readonly savedSections: PageSectionTemplate[];
    readonly isRestoring: boolean;
    readonly onRestoreVersion: (version: CampaignPageVersion) => void;
    readonly onAddSectionFromTemplate: (template: PageSectionTemplate) => void;
}
// Static presets loaded from sections.ts repository

export const HistoryPanel = React.memo(function HistoryPanel({
    versions, currentVersionId, savedSections, isRestoring,
    onRestoreVersion, onAddSectionFromTemplate
}: HistoryPanelProps) {
    const [filter, setFilter] = useState<'all' | 'hero' | 'testimonials' | 'faq' | 'gallery' | 'saved'>('all');
    const { activeWorkspace } = useTenant();
    const [industryFilter, setIndustryFilter] = useState<string | null>(null);

    React.useEffect(() => {
        if (activeWorkspace?.industry) {
            setIndustryFilter(activeWorkspace.industry);
        }
    }, [activeWorkspace?.industry]);

    // Combine static and custom saved sections
    const combined = [
        ...STATIC_SECTION_TEMPLATES.map(s => ({
            ...s,
            workspaceId: '',
            createdAt: new Date().toISOString()
        } as PageSectionTemplate)),
        ...savedSections
    ];

    const filtered = combined.filter((s) => {
        // 1. Category Filter
        if (filter === 'hero' && s.category !== 'hero') return false;
        if (filter === 'testimonials' && s.category !== 'testimonials') return false;
        if (filter === 'faq' && s.category !== 'faq') return false;
        if (filter === 'gallery' && s.category !== 'gallery') return false;
        if (filter === 'saved' && ['hero', 'testimonials', 'faq', 'gallery'].includes(s.category)) return false;

        // 2. Industry Filter
        if (s.id.startsWith('tpl-') && industryFilter && industryFilter !== 'all') {
            if (s.industry && s.industry !== 'all' && s.industry !== industryFilter) {
                return false;
            }
        }
        
        return true;
    });

    const activeIndustry = activeWorkspace?.industry || 'SaaS';

    const heroCount = combined.filter(s => s.category === 'hero' && (!s.id.startsWith('tpl-') || !industryFilter || industryFilter === 'all' || s.industry === 'all' || s.industry === industryFilter)).length;
    const testCount = combined.filter(s => s.category === 'testimonials' && (!s.id.startsWith('tpl-') || !industryFilter || industryFilter === 'all' || s.industry === 'all' || s.industry === industryFilter)).length;
    const faqCount = combined.filter(s => s.category === 'faq' && (!s.id.startsWith('tpl-') || !industryFilter || industryFilter === 'all' || s.industry === 'all' || s.industry === industryFilter)).length;
    const galCount = combined.filter(s => s.category === 'gallery' && (!s.id.startsWith('tpl-') || !industryFilter || industryFilter === 'all' || s.industry === 'all' || s.industry === industryFilter)).length;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Version History */}
            <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-amber-500/10 rounded-lg">
                        <History className="h-4 w-4 text-amber-400" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Version History</h4>
                </div>

                {versions.length > 0 ? (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {versions.map((v) => (
                            <div
                                key={v.id}
                                className={cn(
                                    "p-3 rounded-xl border transition-all duration-200 group",
                                    v.id === currentVersionId
                                        ? "bg-emerald-500/10 border-emerald-500/30"
                                        : "bg-slate-800/50 border-slate-700 hover:border-slate-600"
                                )}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[11px] font-bold text-slate-200">
                                            v{v.versionNumber}
                                            {v.isPublishedVersion && (
                                                <Badge className="ml-2 text-[7px] h-4 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">LIVE</Badge>
                                            )}
                                            {v.id === currentVersionId && (
                                                <Badge className="ml-2 text-[7px] h-4 bg-violet-500/20 text-violet-400 border-violet-500/30">CURRENT</Badge>
                                            )}
                                        </p>
                                        <p className="text-[9px] text-slate-500 mt-0.5">
                                            {new Date(v.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            {' · '}{v.structureJson.sections.length} section{v.structureJson.sections.length !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                    {v.id !== currentVersionId && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            disabled={isRestoring}
                                            onClick={() => onRestoreVersion(v)}
                                            className="h-7 text-[9px] font-bold text-amber-400 hover:bg-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            {isRestoring ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Restore'}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-6 border-2 border-dashed border-slate-700 rounded-2xl bg-slate-800/30">
                        <History className="h-6 w-6 text-slate-600 mx-auto mb-2" />
                        <p className="text-[10px] text-slate-500 font-medium">No versions saved yet</p>
                    </div>
                )}
            </section>

            {/* Section Library */}
            <section className="space-y-4 pt-4 border-t border-slate-700/50">
                <div className="flex items-center justify-between mb-2 gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-violet-500/10 rounded-lg">
                            <FolderHeart className="h-4 w-4 text-violet-400" />
                        </div>
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Section Library</h4>
                    </div>
                    <div className="w-[130px]">
                        <Select
                            value={industryFilter || 'all'}
                            onValueChange={(val) => setIndustryFilter(val === 'all' ? null : val)}
                        >
                            <SelectTrigger className="bg-slate-800/50 border-slate-700 focus:ring-emerald-500/50 text-slate-300 rounded-lg h-7 text-[10px] font-bold">
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
                </div>

                {/* Filter Chips */}
                <div className="flex gap-1.5 pb-2 overflow-x-auto pr-1 custom-scrollbar">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFilter('all')}
                        className={cn(
                            "h-6 px-2.5 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0",
                            filter === 'all' ? "bg-slate-700 text-emerald-400" : "text-slate-400 hover:text-slate-350"
                        )}
                    >
                        All ({filtered.length})
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFilter('hero')}
                        className={cn(
                            "h-6 px-2.5 rounded-full text-[9px] font-bold uppercase tracking-wider gap-1 shrink-0",
                            filter === 'hero' ? "bg-slate-700 text-emerald-400" : "text-slate-400 hover:text-slate-350"
                        )}
                    >
                        <Sparkles className="w-2.5 h-2.5" /> Hero ({heroCount})
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFilter('testimonials')}
                        className={cn(
                            "h-6 px-2.5 rounded-full text-[9px] font-bold uppercase tracking-wider gap-1 shrink-0",
                            filter === 'testimonials' ? "bg-slate-700 text-emerald-400" : "text-slate-400 hover:text-slate-350"
                        )}
                    >
                        <Quote className="w-2.5 h-2.5" /> Testimonials ({testCount})
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFilter('faq')}
                        className={cn(
                            "h-6 px-2.5 rounded-full text-[9px] font-bold uppercase tracking-wider gap-1 shrink-0",
                            filter === 'faq' ? "bg-slate-700 text-emerald-400" : "text-slate-400 hover:text-slate-350"
                        )}
                    >
                        <HelpCircle className="w-2.5 h-2.5" /> FAQ ({faqCount})
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFilter('gallery')}
                        className={cn(
                            "h-6 px-2.5 rounded-full text-[9px] font-bold uppercase tracking-wider gap-1 shrink-0",
                            filter === 'gallery' ? "bg-slate-700 text-emerald-400" : "text-slate-400 hover:text-slate-350"
                        )}
                    >
                        <ImageIcon className="w-2.5 h-2.5" /> Gallery ({galCount})
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFilter('saved')}
                        className={cn(
                            "h-6 px-2.5 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0",
                            filter === 'saved' ? "bg-slate-700 text-emerald-400" : "text-slate-400 hover:text-slate-350"
                        )}
                    >
                        Saved ({savedSections.length})
                    </Button>
                </div>

                {filtered.length > 0 ? (
                    <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                        {filtered.map(s => (
                            <div
                                key={s.id}
                                className="group p-3 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-violet-500/20 cursor-pointer transition-all duration-200 flex items-center justify-between"
                                onClick={() => onAddSectionFromTemplate(s)}
                            >
                                <div className="text-left">
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-[11px] font-bold text-slate-300 group-hover:text-violet-400 transition-colors truncate max-w-[150px]">{s.name}</p>
                                        {s.industry && s.industry === activeIndustry && (
                                            <Badge className="text-[6px] h-3 bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-bold px-1 rounded-sm uppercase tracking-wider shrink-0">
                                                REC
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-[9px] text-slate-500">
                                        {s.category} · {s.structure.blocks.length} block{s.structure.blocks.length !== 1 ? 's' : ''}
                                    </p>
                                </div>
                                <Badge variant="outline" className="text-[7px] h-4 bg-slate-900 border-slate-700 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                    + ADD
                                </Badge>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="py-8 text-center border-2 border-dashed border-slate-700 rounded-2xl bg-slate-800/30">
                        <FolderHeart className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                        <p className="text-[10px] text-slate-500 font-medium px-4 leading-relaxed">No templates found in this category.</p>
                        {filter === 'saved' && <p className="text-[9px] text-slate-600 mt-1">Save sections from the canvas to reuse them.</p>}
                    </div>
                )}
            </section>
        </div>
    );
});

HistoryPanel.displayName = 'HistoryPanel';
export default HistoryPanel;
