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
    Upload, 
    Sparkles, 
    Loader2,
    ArrowRight,
    Zap,
    Target
} from "lucide-react";
import Link from "next/link";
import { RainbowButton } from "@/components/ui/rainbow-button";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useFirestore } from "@/firebase";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * @fileOverview Pro Max Intelligence Hub Dashboard.
 * Consumes the active workspace context to display track-specific analytics with shared visibility support.
 */
export default function AdminDashboardPage() {
    const { activeWorkspaceId, activeWorkspace, isLoading: isWorkspaceLoading } = useWorkspace();
    const firestore = useFirestore();
    const [dashboardData, setDashboardData] = React.useState<any>(null);
    const [isLoadingData, setIsLoadingData] = React.useState(true);

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

        if (!isWorkspaceLoading) {
            fetchStats();
        }
    }, [activeWorkspaceId, isWorkspaceLoading, firestore]);

    if (isWorkspaceLoading || isLoadingData) {
        return (
            <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5">
                <div className="max-w-7xl mx-auto space-y-8">
                    <div className="flex justify-end h-9">
                        <Skeleton className="h-full w-64 rounded-xl" />
                    </div>
                    <DashboardSkeleton />
                </div>
            </div>
        );
    }

    const isProspectTrack = activeWorkspaceId === 'prospect';

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5 text-left">
            <div className="max-w-7xl mx-auto space-y-10">
                {/* Header Context & Navigation */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex flex-col gap-1"
                    >
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-black tracking-tight uppercase">Intelligence Hub</h1>
                            <Badge 
                                variant="outline" 
                                className="font-black uppercase text-[10px] px-3 h-6 border-2 animate-in zoom-in duration-500"
                                style={{ 
                                    borderColor: `${activeWorkspace?.color || '#3B5FFF'}40`,
                                    color: activeWorkspace?.color,
                                    backgroundColor: `${activeWorkspace?.color || '#3B5FFF'}05`
                                }}
                            >
                                {activeWorkspace?.name || 'Active Workspace'}
                            </Badge>
                        </div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-60">
                            Real-time performance audit for the {activeWorkspaceId} track.
                        </p>
                    </motion.div>

                    <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 shrink-0"
                    >
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap shrink-0 ml-1 opacity-40">Direct Entry:</h3>
                        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                            <RainbowButton asChild size="sm" className="justify-start rounded-xl font-bold h-9 shadow-lg">
                                <Link href="/admin/schools/new/ai">
                                    <Sparkles className="h-4 w-4 mr-2" /> AI Architect
                                </Link>
                            </RainbowButton>
                            
                            <Button asChild variant="outline" size="sm" className="justify-start rounded-xl font-bold h-9 bg-white border-primary/10 hover:border-primary/30 transition-all">
                                <Link href="/admin/schools/new">
                                    <PlusCircle className="h-4 w-4 mr-2 text-primary" /> 
                                    {isProspectTrack ? 'Add Lead' : 'Add School'}
                                </Link>
                            </Button>

                            <Button asChild variant="outline" size="sm" className="justify-start rounded-xl font-bold h-9 bg-white border-primary/10 hover:border-primary/30 transition-all">
                                <Link href="/admin/meetings/new">
                                    <CalendarPlus className="h-4 w-4 mr-2 text-primary" /> Session
                                </Link>
                            </Button>

                            <Button asChild variant="outline" size="sm" className="justify-start rounded-xl font-bold h-9 bg-white border-primary/10 hover:border-primary/30 transition-all">
                                <Link href="/admin/surveys/new">
                                    <FilePlus className="h-4 w-4 mr-2 text-primary" /> Survey
                                </Link>
                            </Button>
                        </div>
                    </motion.div>
                </div>

                {/* Dashboard Visualization Grid */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                    className="animate-in fade-in slide-in-from-bottom-4 duration-700 pb-32"
                >
                    <DashboardGrid initialData={dashboardData} />
                </motion.div>
            </div>
        </div>
    );
}
