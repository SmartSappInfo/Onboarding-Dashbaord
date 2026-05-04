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
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-10 border-b border-border/40">
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-1.5 text-left"
            >
                <div className="flex items-center gap-4">
                    <h1 className="text-3xl font-bold text-foreground">Intelligence Hub</h1>
                    <Badge 
                        variant="outline" 
                        className="font-bold text-[10px] px-3 h-6 border uppercase tracking-widest ring-1 ring-border/50"
                        style={{ 
                            borderColor: `${activeWorkspace?.color || '#3B5FFF'}60`,
                            color: activeWorkspace?.color,
                            backgroundColor: `${activeWorkspace?.color || '#3B5FFF'}10`
                        }}
                    >
                        {activeWorkspace?.name || 'Main Operational Track'}
                    </Badge>
                </div>
                <p className="text-muted-foreground text-sm mt-1">
                    Enterprise performance audit for the <span className="text-primary font-bold italic">{activeWorkspaceId}</span> subsystem
                </p>
            </motion.div>

            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex flex-col sm:flex-row items-center gap-4 shrink-0"
            >
                <div className="flex flex-col items-end gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em] mr-1">Operations Console</span>
                    <div className="flex items-center gap-2">
                        <Button asChild variant="ghost" size="sm" className="rounded-xl font-bold h-11 px-6 bg-transparent ring-1 ring-border hover:bg-primary/5 hover:text-primary transition-all active:scale-95 shadow-sm">
                            <Link href="/admin/entities/new">
                                <PlusCircle className="h-4 w-4 mr-2" /> 
                                {isProspectTrack ? 'Add Lead' : `New ${terminology.singular}`}
                            </Link>
                        </Button>

                        <Button onClick={onOpenTaskEditor} variant="ghost" size="sm" className="rounded-xl font-bold h-11 px-6 bg-transparent ring-1 ring-border hover:bg-primary/5 hover:text-primary transition-all active:scale-95 shadow-sm">
                            <CheckSquare className="h-4 w-4 mr-2" /> Task
                        </Button>

                        <Button asChild variant="ghost" size="sm" className="rounded-xl font-bold h-11 px-6 bg-transparent ring-1 ring-border hover:bg-primary/5 hover:text-primary transition-all active:scale-95 shadow-sm">
                            <Link href="/admin/meetings/new">
                                <CalendarPlus className="h-4 w-4 mr-2" /> Session
                            </Link>
                        </Button>

                        <Button asChild variant="ghost" size="sm" className="rounded-xl font-bold h-11 px-6 bg-transparent ring-1 ring-border hover:bg-primary/5 hover:text-primary transition-all active:scale-95 shadow-sm">
                            <Link href="/admin/surveys/new">
                                <FilePlus className="h-4 w-4 mr-2" /> Survey
                            </Link>
                        </Button>

                        {canManageDashboard && (
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={onOpenCustomizer}
                                className="rounded-xl h-11 w-11 bg-transparent ring-1 ring-border hover:bg-primary/5 hover:text-primary transition-all active:scale-95 shadow-sm"
                                title="Customize Perspective"
                            >
                                <LayoutGrid className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
