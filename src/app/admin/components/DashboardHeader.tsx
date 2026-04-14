'use client';

import * as React from "react";
import { Button } from "@/components/ui/button";
import { 
    PlusCircle, 
    CalendarPlus, 
    FilePlus, 
    LayoutGrid,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import type { Workspace } from "@/lib/types";

interface DashboardHeaderProps {
    activeWorkspaceId: string;
    activeWorkspace: Workspace | null;
    canManageDashboard: boolean;
    terminology: { singular: string; plural: string };
    onOpenCustomizer: () => void;
}

export function DashboardHeader({ 
    activeWorkspaceId, 
    activeWorkspace, 
    canManageDashboard,
    terminology,
    onOpenCustomizer
}: DashboardHeaderProps) {
    const isProspectTrack = activeWorkspaceId === 'prospects' || activeWorkspaceId === 'prospect';

    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-border/10">
            <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex flex-col gap-1 text-left"
            >
                <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-headline font-semibold tracking-tight">Intelligence Hub</h1>
                    <Badge 
                        variant="outline" 
                        className="font-semibold text-[10px] px-3 h-6 border-2"
                        style={{ 
                            borderColor: `${activeWorkspace?.color || '#3B5FFF'}40`,
                            color: activeWorkspace?.color,
                            backgroundColor: `${activeWorkspace?.color || '#3B5FFF'}05`
                        }}
                    >
                        {activeWorkspace?.name || 'Active Workspace'}
                    </Badge>
                </div>
                <p className="text-xs font-bold text-muted-foreground opacity-60">
                    Real-time performance audit for the {activeWorkspaceId} track.
                </p>
            </motion.div>

            <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 shrink-0"
            >
                <h3 className="text-[10px] font-headline font-semibold text-muted-foreground whitespace-nowrap shrink-0 ml-1 opacity-40 uppercase tracking-widest">Quick Actions:</h3>
                <div className="flex flex-wrap items-center gap-2">
                    <Button asChild variant="outline" size="sm" className="rounded-xl font-bold h-9 bg-background/50 backdrop-blur-sm border-primary/10 hover:border-primary/30 hover:bg-background/80 transition-all">
                        <Link href="/admin/entities/new">
                            <PlusCircle className="h-4 w-4 mr-2 text-primary" /> 
                            {isProspectTrack ? 'Add Lead' : `Add ${terminology.singular}`}
                        </Link>
                    </Button>

                    <Button asChild variant="outline" size="sm" className="rounded-xl font-bold h-9 bg-background/50 backdrop-blur-sm border-primary/10 hover:border-primary/30 hover:bg-background/80 transition-all">
                        <Link href="/admin/meetings/new">
                            <CalendarPlus className="h-4 w-4 mr-2 text-primary" /> Session
                        </Link>
                    </Button>

                    <Button asChild variant="outline" size="sm" className="rounded-xl font-bold h-9 bg-background/50 backdrop-blur-sm border-primary/10 hover:border-primary/30 hover:bg-background/80 transition-all">
                        <Link href="/admin/surveys/new">
                            <FilePlus className="h-4 w-4 mr-2 text-primary" /> Survey
                        </Link>
                    </Button>

                    {canManageDashboard && (
                        <Button 
                            variant="outline" 
                            size="icon" 
                            onClick={onOpenCustomizer}
                            className="rounded-xl h-9 w-9 bg-background/50 backdrop-blur-sm border-primary/10 hover:border-primary/30 hover:bg-background/80 transition-all"
                            title="Customize Dashboard"
                        >
                            <LayoutGrid className="h-4 w-4 text-primary" />
                        </Button>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
