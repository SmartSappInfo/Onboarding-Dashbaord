'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { History, FolderHeart, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CampaignPageVersion, PageSectionTemplate } from '@/lib/types';

interface HistoryPanelProps {
    versions: CampaignPageVersion[];
    currentVersionId: string | null;
    savedSections: PageSectionTemplate[];
    isRestoring: boolean;
    onRestoreVersion: (version: CampaignPageVersion) => void;
    onAddSectionFromTemplate: (template: PageSectionTemplate) => void;
}

const HistoryPanel = React.memo(function HistoryPanel({
    versions, currentVersionId, savedSections, isRestoring,
    onRestoreVersion, onAddSectionFromTemplate
}: HistoryPanelProps) {
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
                <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-violet-500/10 rounded-lg">
                        <FolderHeart className="h-4 w-4 text-violet-400" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Section Library</h4>
                </div>

                {savedSections.length > 0 ? (
                    <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                        {savedSections.map(s => (
                            <div
                                key={s.id}
                                className="group p-3 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-violet-500/20 cursor-pointer transition-all duration-200 flex items-center justify-between"
                                onClick={() => onAddSectionFromTemplate(s)}
                            >
                                <div>
                                    <p className="text-[11px] font-bold text-slate-300 group-hover:text-violet-400 transition-colors">{s.name}</p>
                                    <p className="text-[9px] text-slate-500">{s.category} · {s.structure.blocks.length} block{s.structure.blocks.length !== 1 ? 's' : ''}</p>
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
                        <p className="text-[10px] text-slate-500 font-medium px-4 leading-relaxed">Your library is empty.</p>
                        <p className="text-[9px] text-slate-600 mt-1">Save sections from the canvas to reuse them.</p>
                    </div>
                )}
            </section>
        </div>
    );
});

export default HistoryPanel;
