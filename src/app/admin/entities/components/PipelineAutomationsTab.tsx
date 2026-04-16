'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Workflow, ArrowRightLeft, Zap, CheckCircle2, PlayCircle, Clock } from 'lucide-react';
import type { WorkspaceEntity } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function PipelineAutomationsTab({
    weData,
    onTransferPipeline
}: {
    weData: WorkspaceEntity;
    onTransferPipeline: () => void;
}) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Pipeline State Card */}
            <Card className="border-none shadow-sm rounded-[2rem] bg-card overflow-hidden">
                <CardHeader className="border-b bg-card/20 pb-5 px-8 pt-8">
                    <CardTitle className="text-[10px] font-semibold text-primary flex items-center gap-2">
                        <Workflow className="h-4 w-4" /> Active Pipeline Stage
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                    <div className="flex flex-col gap-4">
                        <div className="p-5 rounded-2xl bg-primary/5 border border-primary/10">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Current Stage</p>
                            <div className="flex items-center justify-between gap-4">
                                <h3 className="text-2xl font-bold tracking-tight text-primary">
                                    {weData.currentStageName || 'Not Set'}
                                </h3>
                                <Badge className="text-[10px] font-bold px-3 py-1 bg-primary text-white border-none shadow-sm uppercase tracking-tighter">Active Stage</Badge>
                            </div>
                        </div>

                        <Button 
                            variant="outline" 
                            className="w-full justify-start h-12 rounded-xl font-bold text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100 hover:text-blue-700 transition-colors shadow-sm"
                            onClick={onTransferPipeline}
                        >
                            <ArrowRightLeft className="mr-3 h-4 w-4" /> Transfer to New Pipeline
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Automations State Card Placeholder */}
            <Card className="border-none shadow-sm rounded-[2rem] bg-card overflow-hidden">
                <CardHeader className="border-b bg-card/20 pb-5 px-8 pt-8 flex-row items-center justify-between">
                    <CardTitle className="text-[10px] font-semibold text-primary flex items-center gap-2 uppercase tracking-tighter">
                        <Zap className="h-4 w-4" /> Running Automations
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-8">
                    <div className="flex flex-col items-center justify-center py-10 text-center border-2 border-dashed border-border/50 rounded-[2rem] bg-muted/20">
                        <div className="h-12 w-12 rounded-[1rem] bg-muted flex items-center justify-center mb-4 border border-border/50">
                            <Clock className="h-5 w-5 text-muted-foreground opacity-50" />
                        </div>
                        <h4 className="text-base font-bold tracking-tight mb-2">No Active Playbooks</h4>
                        <p className="text-[10px] font-semibold text-muted-foreground max-w-[250px] leading-relaxed">
                            This contact is not currently enrolled in any automated message sequences or workflow playbooks.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
