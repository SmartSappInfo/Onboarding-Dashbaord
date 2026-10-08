'use client';

import * as React from "react";
import { Button } from "@/components/ui/button";
import { 
    PlusCircle, 
    CalendarPlus, 
    FilePlus, 
    LayoutGrid,
    CheckSquare
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { CardInfoTooltip } from "@/components/shared/CardInfoTooltip";
import type { Workspace } from "@/lib/types";

interface DashboardHeaderProps {
    activeWorkspaceId: string;
    activeWorkspace: Workspace | null;
    canManageDashboard: boolean;
    terminology: { singular: string; plural: string };
    onOpenCustomizer: () => void;
    onOpenTaskEditor?: () => void;
}

export function DashboardHeader({ 
    activeWorkspaceId, 
    activeWorkspace, 
    canManageDashboard,
    terminology,
    onOpenCustomizer,
    onOpenTaskEditor
}: DashboardHeaderProps) {
    const isProspectTrack = activeWorkspaceId === 'prospects' || activeWorkspaceId === 'prospect';

    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 sm:pb-5 border-b border-border/40">
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-1.5 text-left"
            >
                <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Intelligence Hub</h1>
                    <CardInfoTooltip text={`Enterprise performance audit for the ${activeWorkspace?.name || activeWorkspaceId} subsystem`} />
                    {activeWorkspace?.name && (
                        <Badge 
                            variant="outline" 
                            className="font-bold text-[10px] px-2.5 h-6 border uppercase tracking-widest ring-1 ring-border/50"
                            style={{ 
                                borderColor: `${activeWorkspace.color || '#3B5FFF'}60`,
                                color: activeWorkspace.color,
                                backgroundColor: `${activeWorkspace.color || '#3B5FFF'}10`
                            }}
                        >
                            {activeWorkspace.name}
                        </Badge>
                    )}
                </div>
            </motion.div>

            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-center gap-2 flex-wrap shrink-0"
            >
                <Button asChild size="sm" className="rounded-xl font-bold h-11 px-5 bg-primary text-primary-foreground hover:bg-primary/90 transition-all active:scale-[0.97] shadow-sm">
                    <Link href="/admin/entities/new">
                        <PlusCircle className="h-4 w-4 mr-2" /> 
                        {isProspectTrack ? 'Add Lead' : `New ${terminology.singular}`}
                    </Link>
                </Button>

                <Button onClick={onOpenTaskEditor} variant="outline" size="sm" className="rounded-xl font-bold h-11 px-5 bg-card text-card-foreground border border-border/80 hover:bg-muted/80 transition-all active:scale-[0.97] shadow-xs">
                    <CheckSquare className="h-4 w-4 mr-2 text-primary" /> Task
                </Button>

                <Button asChild variant="outline" size="sm" className="rounded-xl font-bold h-11 px-5 bg-card text-card-foreground border border-border/80 hover:bg-muted/80 transition-all active:scale-[0.97] shadow-xs">
                    <Link href="/admin/meetings/new">
                        <CalendarPlus className="h-4 w-4 mr-2 text-primary" /> Session
                    </Link>
                </Button>

                <Button asChild variant="outline" size="sm" className="rounded-xl font-bold h-11 px-5 bg-card text-card-foreground border border-border/80 hover:bg-muted/80 transition-all active:scale-[0.97] shadow-xs">
                    <Link href="/admin/surveys/new">
                        <FilePlus className="h-4 w-4 mr-2 text-primary" /> Survey
                    </Link>
                </Button>

                {canManageDashboard && (
                    <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={onOpenCustomizer}
                        className="rounded-xl h-11 w-11 bg-card text-card-foreground border border-border/80 hover:bg-muted/80 transition-all active:scale-[0.97] shadow-xs"
                        title="Customize Perspective"
                    >
                        <LayoutGrid className="h-4 w-4 text-primary" />
                    </Button>
                )}
            </motion.div>
        </div>
    );
}
