import * as React from "react";
import { Suspense } from "react";
import { getActiveWorkspace, getDashboardLayout, getWorkspacePipelines } from "@/lib/dashboard-server";
import DashboardGrid from "./components/DashboardGrid";
import { DashboardClientWrapper } from "./components/DashboardClientWrapper";
import { 
    LayoutGrid,
    Database
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

// Widget Server Components
import { MetricsWidgetServer } from "./components/widgets/MetricsWidgetServer";
import { TaskWidgetServer } from "./components/widgets/TaskWidgetServer";
import { MeetingsWidgetServer } from "./components/widgets/MeetingsWidgetServer";
import { SurveysWidgetServer } from "./components/widgets/SurveysWidgetServer";
import { PipelineWidgetServer } from "./components/widgets/PipelineWidgetServer";
import { MonthlyChartWidgetServer } from "./components/widgets/MonthlyChartWidgetServer";
import { ActivityWidgetServer } from "./components/widgets/ActivityWidgetServer";
import { ModuleChartWidgetServer } from "./components/widgets/ModuleChartWidgetServer";
import { ZoneChartWidgetServer } from "./components/widgets/ZoneChartWidgetServer";
import { UserAssignmentsWidgetServer } from "./components/widgets/UserAssignmentsWidgetServer";
import { MessagingWidgetServer } from "./components/widgets/MessagingWidgetServer";

interface AdminDashboardPageProps {
    searchParams: Promise<{ track?: string }>;
}

export default async function AdminDashboardPage({ searchParams }: AdminDashboardPageProps) {
    const params = await searchParams;
    const activeWorkspaceId = params.track;

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

    const [activeWorkspace, layoutData, pipelines] = await Promise.all([
        getActiveWorkspace(activeWorkspaceId),
        getDashboardLayout(activeWorkspaceId),
        getWorkspacePipelines(activeWorkspaceId)
    ]);

    if (!activeWorkspace) {
        return (
            <div className="p-8 text-center">
                <p className="text-muted-foreground">Workspace not found or unauthorized.</p>
            </div>
        );
    }

    const terminology = activeWorkspace.terminology || { singular: 'Entity', plural: 'Entities' };

    // Placeholder skeleton for widget streaming
    const WidgetSkeleton = () => <div className="h-64 bg-muted/20 animate-pulse rounded-2xl" />;
    const ChartSkeleton = () => <div className="h-96 bg-muted/20 animate-pulse rounded-2xl" />;

    // Construct the widget map
    const widgets: Record<string, React.ReactNode> = {
        metricsRow: (
            <Suspense fallback={<div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"><WidgetSkeleton /><WidgetSkeleton /><WidgetSkeleton /><WidgetSkeleton /></div>}>
                <MetricsWidgetServer workspaceId={activeWorkspaceId} />
            </Suspense>
        ),
        taskWidget: (
            <Suspense fallback={<WidgetSkeleton />}>
                <TaskWidgetServer workspaceId={activeWorkspaceId} />
            </Suspense>
        ),
        upcomingMeetings: (
            <Suspense fallback={<WidgetSkeleton />}>
                <MeetingsWidgetServer workspaceId={activeWorkspaceId} />
            </Suspense>
        ),
        latestSurveys: (
            <Suspense fallback={<WidgetSkeleton />}>
                <SurveysWidgetServer workspaceId={activeWorkspaceId} />
            </Suspense>
        ),
        pipelinePieChart: (
            <Suspense fallback={<ChartSkeleton />}>
                <PipelineWidgetServer workspaceId={activeWorkspaceId} />
            </Suspense>
        ),
        monthlySchoolsChart: (
            <Suspense fallback={<ChartSkeleton />}>
                <MonthlyChartWidgetServer workspaceId={activeWorkspaceId} />
            </Suspense>
        ),
        recentActivity: (
            <Suspense fallback={<div className="h-[500px] bg-muted/20 animate-pulse rounded-2xl" />}>
                <ActivityWidgetServer workspaceId={activeWorkspaceId} />
            </Suspense>
        ),
        moduleRadarChart: (
            <Suspense fallback={<ChartSkeleton />}>
                <ModuleChartWidgetServer workspaceId={activeWorkspaceId} />
            </Suspense>
        ),
        zoneDistribution: (
            <Suspense fallback={<ChartSkeleton />}>
                <ZoneChartWidgetServer workspaceId={activeWorkspaceId} />
            </Suspense>
        ),
        userAssignments: (
            <Suspense fallback={<ChartSkeleton />}>
                <UserAssignmentsWidgetServer workspaceId={activeWorkspaceId} />
            </Suspense>
        ),
        messagingWidget: (
            <Suspense fallback={<WidgetSkeleton />}>
                <MessagingWidgetServer workspaceId={activeWorkspaceId} />
            </Suspense>
        ),
    };

    // Add dynamic pipeline widgets
    pipelines.forEach(p => {
        const id = `pipeline_${p.id}`;
        widgets[id] = (
            <Suspense fallback={<ChartSkeleton />}>
                <PipelineWidgetServer workspaceId={activeWorkspaceId} />
            </Suspense>
        );
    });

    return (
        <div className="h-full overflow-y-auto bg-background text-left p-4 sm:p-8">
            <DashboardClientWrapper 
                activeWorkspaceId={activeWorkspaceId}
                activeWorkspace={activeWorkspace}
                terminology={terminology}
                pipelines={pipelines}
                widgets={widgets}
            />
        </div>
    );
}
