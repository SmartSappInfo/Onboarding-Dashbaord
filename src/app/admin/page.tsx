'use client';

import * as React from "react";
import { getDashboardData } from "@/lib/dashboard";
import { DashboardSkeleton } from "./components/DashboardSkeleton";
import DashboardGrid from "./components/DashboardGrid";
import { Button } from "@/components/ui/button";
import { 
    PlusCircle, 
    CalendarPlus, 
    FilePlus, 
    LayoutGrid,
    Database
} from "lucide-react";
import Link from "next/link";
import { useTenant } from "@/context/TenantContext";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Pipeline } from '@/lib/types';
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

/**
 * @fileOverview Intelligence Hub Dashboard.
 * Consume useTenant to ensure strict partitioning of all operational metrics.
 */
export default function AdminDashboardPage() {
    const { activeWorkspaceId, activeWorkspace, isLoading: isTenantLoading, hasPermission } = useTenant();
    const firestore = useFirestore();
    
    const [dashboardData, setDashboardData] = React.useState<any>(null);
    const [isLoadingData, setIsLoadingData] = React.useState(true);
    const [isWidgetSelectorOpen, setIsWidgetSelectorOpen] = React.useState(false);

    // Dynamic terminology resolution
    const terminology = React.useMemo(() => {
        return activeWorkspace?.terminology || { singular: 'Entity', plural: 'Entities' };
    }, [activeWorkspace]);

    const canManageDashboard = hasPermission('dashboard_manage');
    const isProspectTrack = activeWorkspaceId === 'prospects' || activeWorkspaceId === 'prospect';

    // Fetch workspace pipelines for per-pipeline dashboard widgets
    const pipelinesQuery = useMemoFirebase(() => 
        firestore && activeWorkspaceId ? query(
            collection(firestore, 'pipelines'), 
            where('workspaceIds', 'array-contains', activeWorkspaceId),
            orderBy('createdAt', 'desc')
        ) : null, 
    [firestore, activeWorkspaceId]);
    
    const { data: pipelines } = useCollection<Pipeline>(pipelinesQuery);

    React.useEffect(() => {
        const fetchStats = async () => {
            if (!firestore || !activeWorkspaceId) return;
            setIsLoadingData(true);
            try {
                const data = await getDashboardData(firestore, activeWorkspaceId);
                setDashboardData(data);
            } catch (e) {
                console.error("Dashboard Load Failure:", e);
            } finally {
                setIsLoadingData(false);
            }
        };

        if (!isTenantLoading && activeWorkspaceId) {
            fetchStats();
        }
    }, [activeWorkspaceId, isTenantLoading, firestore]);

    // Premature return for loading states
    if (isTenantLoading || (isLoadingData && !dashboardData && activeWorkspaceId)) {
        return (
            <div className="h-full overflow-y-auto bg-background p-8">
                <div className="space-y-8">
                    <div className="flex justify-between items-center mb-10">
                        <Skeleton className="h-12 w-64 rounded-xl" />
                        <Skeleton className="h-10 w-48 rounded-xl" />
                    </div>
                    <DashboardSkeleton />
                </div>
            </div>
        );
    }

    if (!activeWorkspaceId) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-background">
                <div className="max-w-md space-y-6">
                    <div className="w-16 h-16 mx-auto bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
                        <LayoutGrid className="h-8 w-8 text-primary" />
                    </div>
                    <h2 className="text-2xl font-semibold tracking-tight">Welcome to Intelligence Hub</h2>
                    <p className="text-muted-foreground">
                        You do not currently have an active workspace selected, or your organization has no workspaces. Please select or create a workspace to view dashboard metrics.
                    </p>
                    <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
                        <Button asChild className="rounded-xl font-semibold transform hover:scale-105 transition-all shadow-lg text-xs gap-2 h-11 px-6">
                            <Link href="/admin/seeds">
                                <Database className="w-4 h-4" /> Seed Essential Data
                            </Link>
                        </Button>
                        <Button variant="outline" asChild className="rounded-xl font-semibold border-primary/20 text-primary hover:bg-primary/5 gap-2 h-11 px-6">
                            <Link href="/admin/settings?tab=workspaces">
                                <LayoutGrid className="w-4 h-4" /> Create Workspace
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto bg-background text-left p-4 sm:p-8">
            <div className="space-y-10">
                {/* Header Context */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-border/10">
                    <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex flex-col gap-1"
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
                                    onClick={() => setIsWidgetSelectorOpen(true)}
                                    className="rounded-xl h-9 w-9 bg-background/50 backdrop-blur-sm border-primary/10 hover:border-primary/30 hover:bg-background/80 transition-all"
                                    title="Customize Dashboard"
                                >
                                    <LayoutGrid className="h-4 w-4 text-primary" />
                                </Button>
                            )}
                        </div>
                    </motion.div>
                </div>

                {/* Dashboard Visualization Grid */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                >
                    <DashboardGrid 
                        initialData={dashboardData} 
                        pipelines={pipelines || []} 
                        isCustomizerOpen={isWidgetSelectorOpen}
                        onCustomizerChange={setIsWidgetSelectorOpen}
                    />
                </motion.div>
            </div>
        </div>
    );
}
