'use client';

import * as React from "react";
import { getDashboardData } from "@/lib/dashboard";
import { DashboardSkeleton } from "./components/DashboardSkeleton";
import DashboardGrid from "./components/DashboardGrid";
import { Button } from "@/components/ui/button";
import { PlusCircle, CalendarPlus, FilePlus, Upload, Sparkles, Loader2 } from "lucide-react";
import Link from "next/link";
import { RainbowButton } from "@/components/ui/rainbow-button";
import { usePerspective } from "@/context/PerspectiveContext";

/**
 * @fileOverview Intelligence Hub Dashboard.
 * Consumes the active perspective context to display track-specific analytics.
 */
export default function AdminDashboardPage() {
    const { activeTrack, isLoading: isPerspectiveLoading } = usePerspective();
    const [dashboardData, setDashboardData] = React.useState<any>(null);
    const [isLoadingData, setIsLoadingData] = React.useState(true);

    React.useEffect(() => {
        const fetchStats = async () => {
            setIsLoadingData(true);
            try {
                const data = await getDashboardData(activeTrack);
                setDashboardData(data);
            } catch (e) {
                console.error("Dashboard Load Failure:", e);
            } finally {
                setIsLoadingData(false);
            }
        };

        if (!isPerspectiveLoading) {
            fetchStats();
        }
    }, [activeTrack, isPerspectiveLoading]);

    if (isPerspectiveLoading || isLoadingData) {
        return (
            <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8">
                <div className="max-w-7xl mx-auto space-y-8">
                    <div className="flex justify-end h-9">
                        <Skeleton className="h-full w-64 rounded-xl" />
                    </div>
                    <DashboardSkeleton />
                </div>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5">
            <div className="max-w-7xl mx-auto space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-6">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 shrink-0">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap shrink-0 ml-1">Quick Actions:</h3>
                        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                            <RainbowButton asChild size="sm" className="justify-start rounded-xl font-bold h-9 shadow-lg">
                                <Link href="/admin/schools/new/ai">
                                    <Sparkles className="h-4 w-4 mr-2" /> AI Architect
                                </Link>
                            </RainbowButton>
                            <Button asChild variant="outline" size="sm" className="justify-start rounded-xl font-bold h-9 bg-white">
                                <Link href="/admin/schools/new">
                                    <PlusCircle className="h-4 w-4 mr-2" /> Add School
                                </Link>
                            </Button>
                            <Button asChild variant="outline" size="sm" className="justify-start rounded-xl font-bold h-9 bg-white">
                                <Link href="/admin/meetings/new">
                                    <CalendarPlus className="h-4 w-4 mr-2" /> Session
                                </Link>
                            </Button>
                            <Button asChild variant="outline" size="sm" className="justify-start rounded-xl font-bold h-9 bg-white">
                                <Link href="/admin/surveys/new">
                                    <FilePlus className="h-4 w-4 mr-2" /> Survey
                                </Link>
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <DashboardGrid initialData={dashboardData} />
                </div>
            </div>
        </div>
    );
}
