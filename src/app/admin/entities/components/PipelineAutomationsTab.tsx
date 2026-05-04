'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Zap, Clock, BarChart2, ArrowRight } from 'lucide-react';
import type { WorkspaceEntity } from '@/lib/types';
import Link from 'next/link';

export default function PipelineAutomationsTab({ weData }: { weData: WorkspaceEntity }) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left animate-in fade-in slide-in-from-bottom-2 duration-500">

            {/* Deal Pipeline Link Card */}
            <Card className="border-none shadow-sm rounded-[2rem] bg-card overflow-hidden">
                <CardHeader className="border-b bg-card/20 pb-5 px-8 pt-8">
                    <CardTitle className="text-[10px] font-semibold text-primary flex items-center gap-2 uppercase tracking-tighter">
                        <BarChart2 className="h-4 w-4" /> Deal Pipeline
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-8 space-y-5">
                    <div className="p-5 rounded-2xl bg-primary/5 border border-primary/10">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Lifecycle Status</p>
                        <h3 className="text-2xl font-bold tracking-tight text-primary">
                            {weData.lifecycleStatus || 'Not Set'}
                        </h3>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        Pipeline stage tracking is managed through <span className="font-semibold text-foreground">Deals</span>. 
                        Open, won, and lost deals for this contact are visible in the Deals tab.
                    </p>
                    <Button
                        variant="outline"
                        className="w-full justify-between h-12 rounded-xl font-bold text-primary bg-primary/5 border-primary/20 hover:bg-primary/10 transition-colors shadow-sm"
                        asChild
                    >
                        <Link href="/admin/pipeline">
                            View Deal Pipeline Board
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </Button>
                </CardContent>
            </Card>

            {/* Automations State Card */}
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
