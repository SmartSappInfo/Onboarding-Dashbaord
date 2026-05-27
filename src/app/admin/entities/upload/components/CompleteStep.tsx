'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, ClipboardList, ExternalLink, RefreshCw, Eye, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface CompleteStepProps {
    terms: { singular: string; plural: string };
    rawData: any[];
    failedRowIndices: number[];
    executionResults: any[];
    activeImportLog: any;
    lastImportLogId: string | null;
    onImportAnother: () => void;
    onViewImports: () => void;
    onGoToEntities: () => void;
    onStartCorrection: () => void;
}

export function CompleteStep({
    terms,
    rawData,
    failedRowIndices,
    executionResults,
    activeImportLog,
    lastImportLogId,
    onImportAnother,
    onViewImports,
    onGoToEntities,
    onStartCorrection,
}: CompleteStepProps) {
    return (
        <div className="space-y-6">
            <Card className="rounded-2xl border border-border/40 shadow-xl overflow-hidden bg-white dark:bg-[#0f1117] relative">
                {/* Status Header Section - Left-Aligned Icon Layout */}
                <CardHeader className={cn(
                    "py-12 px-10 border-b-0 relative overflow-hidden",
                    failedRowIndices.length === 0 ? "bg-emerald-500/[0.02]" : "bg-rose-500/[0.02]"
                )}>
                    {/* Ambient Glow */}
                    <div className={cn(
                        "absolute inset-0 blur-[100px] opacity-10",
                        failedRowIndices.length === 0 ? "bg-emerald-500" : "bg-rose-500"
                    )} />
                    
                    <div className="relative z-10 flex items-start gap-8">
                        <div className={cn(
                            "w-20 h-20 rounded-2xl flex items-center justify-center shadow-2xl border shrink-0",
                            failedRowIndices.length === 0 
                                ? "bg-emerald-500 text-white border-emerald-400/50 shadow-emerald-500/20" 
                                : "bg-rose-500 text-white border-rose-400/50 shadow-rose-500/20"
                        )}>
                            {failedRowIndices.length === 0
                                ? <CheckCircle2 size={36} strokeWidth={3} />
                                : <AlertCircle size={36} strokeWidth={2.5} />
                            }
                        </div>

                        <div className="flex-1 space-y-2 pt-1">
                            <CardTitle className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                                {failedRowIndices.length === 0 ? 'Import Successfully Finalized' : 'Import Partially Completed'}
                            </CardTitle>
                            <p className="text-slate-500 dark:text-slate-400 font-medium text-sm leading-relaxed max-w-2xl">
                                {failedRowIndices.length === 0 
                                    ? 'Your data ecosystem has been successfully synchronized. All records are now active within the workspace directory and ready for automation workflows.' 
                                    : 'The ingestion process is finished, but some records required manual intervention due to validation discrepancies or duplicate entries.'}
                            </p>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="px-10 pb-10 space-y-10">
                    {/* High-Impact Stats Bar */}
                    <div className="grid grid-cols-4 gap-4">
                        <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-border/50 shadow-sm">
                            <p className="text-3xl font-black text-slate-800 dark:text-white mb-0.5">{rawData.length}</p>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Submitted</p>
                        </div>
                        <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-border/50 shadow-sm relative overflow-hidden">
                            {activeImportLog?.status === 'processing' || activeImportLog?.status === 'queued' ? (
                                <div className="absolute inset-x-0 bottom-0 h-1 bg-blue-100">
                                    <div 
                                        className="h-full bg-blue-500 transition-all duration-500" 
                                        style={{ width: `${Math.max(5, ((activeImportLog?.successCount || 0) + (activeImportLog?.failedCount || 0) + (activeImportLog?.duplicateCount || 0)) / rawData.length * 100)}%` }}
                                    />
                                </div>
                            ) : null}
                            <div className="flex items-center gap-1.5 mb-0.5 relative z-10">
                                {activeImportLog?.status === 'processing' || activeImportLog?.status === 'queued' ? (
                                    <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                                ) : activeImportLog?.status === 'completed' || activeImportLog?.status === 'completed_with_errors' ? (
                                    <CheckCircle2 size={14} className="text-emerald-500" />
                                ) : null}
                                <p className="text-3xl font-black text-emerald-600">
                                    {activeImportLog?.successCount || 0}
                                </p>
                            </div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] relative z-10">Created</p>
                        </div>
                        <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-border/50 shadow-sm transition-all hover:border-amber-500/30">
                            <p className="text-3xl font-black text-amber-500 mb-0.5">{activeImportLog?.duplicateCount || 0}</p>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Duplicates</p>
                        </div>
                        <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-border/50 shadow-sm transition-all hover:border-rose-500/30">
                            <p className="text-3xl font-black text-rose-500 mb-0.5">{activeImportLog?.failedCount || 0}</p>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Failed</p>
                        </div>
                    </div>

                    {/* Track Import Banner */}
                    {lastImportLogId && (
                        <button
                            onClick={onViewImports}
                            className="w-full flex items-center gap-4 p-4 rounded-xl border border-primary/20 bg-primary/[0.03] hover:bg-primary/[0.06] transition-colors text-left group"
                        >
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <ClipboardList size={18} className="text-primary" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-bold text-slate-800 dark:text-white">Track Import Progress</p>
                                <p className="text-xs text-slate-500">Live status, duplicates &amp; failure resolution</p>
                            </div>
                            <ExternalLink size={16} className="text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </button>
                    )}

                    {/* Integrated Validation Log (Only if errors exist) */}
                    {failedRowIndices.length > 0 && (
                        <div className="rounded-2xl border border-rose-200/50 overflow-hidden shadow-sm bg-rose-500/[0.01]">
                            <div className="px-5 py-3 bg-rose-500/[0.03] border-b border-rose-200/50 flex items-center justify-between">
                                <p className="text-[10px] font-black text-rose-700 uppercase tracking-widest flex items-center gap-2">
                                    <AlertCircle size={12} /> Validation Discrepancies ({failedRowIndices.length})
                                </p>
                                <Button 
                                    onClick={onStartCorrection} 
                                    variant="outline" 
                                    size="sm"
                                    className="h-7 text-[10px] font-bold border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg animate-none"
                                >
                                    Open Correction Console
                                </Button>
                            </div>
                            <ScrollArea className="max-h-[220px]">
                                {executionResults.filter(r => r.status === 'error').map(r => (
                                    <div key={r.row} className="px-5 py-3 border-b border-rose-100/30 last:border-0 flex items-center gap-4 group">
                                        <Badge variant="outline" className="bg-rose-500/5 text-rose-600 border-rose-200 text-[9px] shrink-0 font-bold px-2 py-0.5">ROW {r.row + 1}</Badge>
                                        <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 truncate group-hover:text-rose-700 transition-colors">{r.error}</p>
                                    </div>
                                ))}
                            </ScrollArea>
                        </div>
                    )}

                    {/* Action Footers - Horizontal Layout */}
                    <div className="flex items-center gap-4 pt-2">
                        <Button 
                            onClick={onImportAnother} 
                            variant="outline"
                            className="flex-1 h-14 rounded-xl font-black text-sm transition-all active:scale-[0.98] uppercase tracking-wider border-border hover:bg-slate-50 dark:hover:bg-slate-900 animate-none"
                        >
                            <RefreshCw size={18} className="mr-2" /> Import Another
                        </Button>
                        <Button 
                            onClick={onViewImports} 
                            variant="outline"
                            className="flex-1 h-14 rounded-xl font-black text-sm transition-all active:scale-[0.98] uppercase tracking-wider border-primary/20 text-primary hover:bg-primary/5 animate-none"
                        >
                            <Eye size={18} className="mr-2" /> View Imports
                        </Button>
                        <Button 
                            onClick={onGoToEntities} 
                            className="flex-1 h-14 rounded-xl font-black text-sm transition-all active:scale-[0.98] uppercase tracking-wider gap-2 bg-[#4d69ff] hover:bg-[#3d59ef] text-white shadow-lg shadow-primary/20 animate-none"
                        >
                            Go to {terms.plural} <ArrowRight size={18} />
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
